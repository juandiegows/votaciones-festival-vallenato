"""
Piezas de `logging` que usa settings.LOGGING:

- FiltroContexto: agrega a cada línea la petición en curso (id, usuario, IP, método y ruta).
- FormatoJSON: una línea JSON por evento (producción: `docker logs` y los archivos de LOG_DIR).
- ManejadorBaseDatos: guarda los errores en RegistroSistema para verlos en /panel/registros, con la traza y el
  archivo y la línea de nuestro código donde ocurrió el fallo.
"""

import json
import logging
import random
import sys
import threading
import traceback
from datetime import timedelta
from pathlib import Path

from .interceptor import peticion_actual

RAIZ = Path(__file__).resolve().parents[2]  # app/api
CAMPOS_PETICION = ("id_solicitud", "usuario", "ip", "metodo", "ruta")


def _ruta_relativa(archivo):
    try:
        return Path(archivo).resolve().relative_to(RAIZ).as_posix()
    except (ValueError, OSError):
        return str(archivo)


def _es_nuestro(archivo):
    """True si el archivo es del proyecto (no de Python, Django ni otra librería instalada)."""
    ruta = _ruta_relativa(archivo)
    return not Path(ruta).is_absolute() and "site-packages" not in ruta and not ruta.startswith(".venv")


def _peticion(registro):
    # django.request pasa la petición en `request`; en los demás casos se toma la que está en curso
    return getattr(registro, "request", None) or peticion_actual()


def _usuario(peticion):
    usuario = getattr(peticion, "user", None)
    return usuario if usuario is not None and getattr(usuario, "is_authenticated", False) else None


def _ip(peticion):
    from ..comun.api import ip_cliente

    try:
        return ip_cliente(peticion)
    except Exception:  # noqa: BLE001 — una petición incompleta no debe impedir el registro
        return None


class FiltroContexto(logging.Filter):
    def filter(self, registro):
        peticion = _peticion(registro)
        usuario = _usuario(peticion)
        valores = {
            "id_solicitud": getattr(peticion, "id_solicitud", "") or "-",
            "usuario": getattr(usuario, "email", "") or "-",
            "ip": (_ip(peticion) if peticion is not None else None) or "-",
            "metodo": getattr(peticion, "method", "") or "-",
            "ruta": peticion.get_full_path()[:300] if peticion is not None else "-",
        }
        for campo, valor in valores.items():
            if not hasattr(registro, campo):
                setattr(registro, campo, valor)
        return True


class FormatoJSON(logging.Formatter):
    def format(self, registro):
        datos = {
            "fecha": self.formatTime(registro, "%Y-%m-%dT%H:%M:%S"),
            "nivel": registro.levelname,
            "origen": registro.name,
            "mensaje": registro.getMessage(),
            **{c: getattr(registro, c, "-") for c in CAMPOS_PETICION},
        }
        for campo in ("estado_http", "duracion_ms"):
            if hasattr(registro, campo):
                datos[campo] = getattr(registro, campo)
        if registro.levelno >= logging.WARNING:
            datos["archivo"] = f"{_ruta_relativa(registro.pathname)}:{registro.lineno}"
        if registro.exc_info:
            datos["traza"] = self.formatException(registro.exc_info)
        return json.dumps(datos, ensure_ascii=False, default=str)


def datos_excepcion(exc_info):
    """Tipo y mensaje, traza completa y el último punto de NUESTRO código por el que pasó el error."""
    tipo, error, tb = exc_info
    marcos = traceback.extract_tb(tb)
    propios = [m for m in marcos if _es_nuestro(m.filename)]
    marco = (propios or marcos or [None])[-1]
    return {
        "excepcion": f"{tipo.__name__}: {error}"[:255],
        "traza": "".join(traceback.format_exception(tipo, error, tb)),
        "archivo": _ruta_relativa(marco.filename)[:255] if marco else "",
        "linea": marco.lineno if marco else None,
        "funcion": (marco.name if marco else "")[:120],
    }


class ManejadorBaseDatos(logging.Handler):
    """
    Guarda en RegistroSistema los eventos desde su nivel (LOG_NIVEL_BD, ERROR por defecto). Si falla (base de datos
    caída, tabla sin migrar), lo avisa por stderr y sigue: un error al registrar nunca tumba la petición.
    Limitación: si se registra dentro de una transacción que luego se revierte, el registro se pierde con ella;
    los errores sin atrapar (500) se registran fuera de las transacciones y no tienen ese problema.
    """

    _local = threading.local()

    def emit(self, registro):
        if getattr(registro, "solo_consola", False) or getattr(self._local, "activo", False):
            return
        if registro.name == "django.request" and getattr(_peticion(registro), "error_registrado", False):
            return  # el interceptor ya guardó esta excepción
        from django.apps import apps

        if not apps.ready:
            return
        self._local.activo = True
        try:
            self.guardar(registro)
        except Exception as error:  # noqa: BLE001
            sys.stderr.write(f"[registros] No se pudo guardar el error en la base de datos: {error!r}\n")
        finally:
            self._local.activo = False

    def guardar(self, registro):
        from django.conf import settings
        from django.utils import timezone

        from .models import RegistroSistema

        peticion = _peticion(registro)
        usuario = _usuario(peticion)
        if registro.exc_info and registro.exc_info[0]:
            ubicacion = datos_excepcion(registro.exc_info)
        else:
            ubicacion = {
                "excepcion": "", "traza": registro.stack_info or "", "archivo": _ruta_relativa(registro.pathname)[:255],
                "linea": registro.lineno, "funcion": (registro.funcName or "")[:120],
            }
        ubicacion.update(getattr(registro, "ubicacion", None) or {})  # errores de la web: archivo y línea del navegador
        estado = getattr(registro, "status_code", None) or getattr(registro, "estado_http", None)
        RegistroSistema.objects.create(
            nivel=registro.levelname[:10],
            fuente=getattr(registro, "fuente", RegistroSistema.Fuente.SERVIDOR),
            origen=registro.name[:100],
            mensaje=registro.getMessage()[:5000],
            metodo=(getattr(peticion, "method", "") or "")[:10],
            ruta=peticion.get_full_path()[:500] if peticion is not None else "",
            estado_http=estado if isinstance(estado, int) else None,
            id_solicitud=(getattr(peticion, "id_solicitud", "") or "")[:32],
            usuario_id=usuario.pk if usuario else None,
            ip=_ip(peticion) if peticion is not None else None,
            navegador=(peticion.META.get("HTTP_USER_AGENT", "") if peticion is not None else "")[:300],
            detalle=getattr(registro, "detalle", None) or {},
            **ubicacion,
        )
        # Limpieza ocasional (≈1 de cada 50 errores): se conservan LOG_DIAS_RETENCION días
        if random.random() < 0.02:  # noqa: S311 — no es criptográfico
            limite = timezone.now() - timedelta(days=settings.LOG_DIAS_RETENCION)
            RegistroSistema.objects.filter(fecha_hora__lt=limite).delete()
