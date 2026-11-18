"""
Verificación en dos pasos (RF-20). Dos métodos, uno a la vez por cuenta:

- App autenticadora (Google Authenticator, Microsoft Authenticator, Authy…): TOTP de RFC 6238 con SHA-1, 6 dígitos
  y periodo de 30 s; se acepta un periodo antes y uno después (relojes desfasados) y el mismo código no sirve dos veces.
- Código por correo: 6 dígitos que vencen en CODIGO_CORREO_MINUTOS con CODIGO_CORREO_INTENTOS intentos.

Al activar se entregan CODIGOS_RESPALDO códigos de un solo uso por si se pierde el celular o el acceso al correo.
El inicio de sesión queda en dos pasos: correo + contraseña devuelve un «desafío» firmado (vence en DESAFIO_SEGUNDOS)
y la sesión solo se abre al verificar el código. Las vistas (API y portal) no repiten reglas: solo llaman a estas
funciones, que lanzan ReglaNegocioError.
"""

import base64
import hashlib
import hmac
import secrets
import struct
import time
from datetime import timedelta
from urllib.parse import quote

import segno
from django.conf import settings
from django.core import signing
from django.db import transaction
from django.utils import timezone

from .. import correo
from ..comun.errores import ReglaNegocioError
from .models import SegundoFactor, Usuario

PERIODO = 30
DIGITOS = 6
TOLERANCIA = 1  # periodos aceptados antes y después del actual
CODIGO_CORREO_MINUTOS = 10
CODIGO_CORREO_INTENTOS = 5
ESPERA_REENVIO_SEGUNDOS = 60
DESAFIO_SEGUNDOS = 300
CODIGOS_RESPALDO = 10
FALLOS_PERMITIDOS = 5
BLOQUEO_MINUTOS = 15
SAL_DESAFIO = "votaciones.2fa-desafio"
EMISOR = "Votaciones Festival Vallenato"


class CodigoInvalido(ReglaNegocioError):
    def __init__(self, mensaje="El código no es correcto. Revísalo e inténtalo de nuevo.", codigo="codigo_invalido"):
        super().__init__(mensaje, codigo=codigo, status=400)


# ---------- TOTP (RFC 6238) ----------

def nueva_clave():
    """Clave de 160 bits en Base32 (lo que se escribe o se escanea en la app)."""
    return base64.b32encode(secrets.token_bytes(20)).decode()


def codigo_totp(clave, paso):
    """Código de 6 dígitos para un periodo (HOTP de RFC 4226 con el contador = periodo)."""
    llave = base64.b32decode(clave + "=" * (-len(clave) % 8), casefold=True)
    resumen = hmac.new(llave, struct.pack(">Q", paso), hashlib.sha1).digest()
    desplazamiento = resumen[-1] & 0x0F
    numero = struct.unpack(">I", resumen[desplazamiento:desplazamiento + 4])[0] & 0x7FFFFFFF
    return str(numero % 10 ** DIGITOS).zfill(DIGITOS)


def paso_actual(ahora=None):
    return int((ahora if ahora is not None else time.time()) // PERIODO)


def paso_del_codigo(clave, codigo, ultimo_paso=0, ahora=None):
    """Periodo al que corresponde el código, o None si no es válido o ya se usó (anti-repetición)."""
    actual = paso_actual(ahora)
    for paso in range(actual - TOLERANCIA, actual + TOLERANCIA + 1):
        if paso > ultimo_paso and hmac.compare_digest(codigo_totp(clave, paso), codigo):
            return paso
    return None


def uri_otpauth(usuario, clave):
    """URI estándar que leen Google Authenticator, Microsoft Authenticator, Authy, 1Password…"""
    etiqueta = quote(f"{EMISOR}:{usuario.email}")
    return (f"otpauth://totp/{etiqueta}?secret={clave}&issuer={quote(EMISOR)}"
            f"&algorithm=SHA1&digits={DIGITOS}&period={PERIODO}")


def qr_svg(texto):
    """Código QR como data URI SVG (se ve igual en el portal y en React, sin depender de un servicio externo)."""
    return segno.make(texto, error="m").svg_data_uri(scale=5, border=2, dark="#000000", light="#FFFFFF")


def clave_agrupada(clave):
    """ABCD EFGH …: más fácil de copiar a mano."""
    return " ".join(clave[i:i + 4] for i in range(0, len(clave), 4))


# ---------- Códigos (correo y respaldo) ----------

def _resumen(texto):
    return hmac.new(settings.SECRET_KEY.encode(), f"2fa:{texto}".encode(), hashlib.sha256).hexdigest()


def _normalizar(codigo):
    return "".join(c for c in str(codigo or "") if c.isalnum()).upper()


def _nuevos_codigos_respaldo():
    alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # sin 0/O ni 1/I: no se confunden al copiarlos
    codigos = ["".join(secrets.choice(alfabeto) for _ in range(10)) for _ in range(CODIGOS_RESPALDO)]
    return [f"{c[:5]}-{c[5:]}" for c in codigos], [_resumen(c) for c in codigos]


def factor_de(usuario):
    return SegundoFactor.objects.get_or_create(usuario=usuario)[0]


def activo(usuario):
    return SegundoFactor.objects.filter(usuario=usuario).exclude(metodo="").exists()


def metodo(usuario):
    return SegundoFactor.objects.filter(usuario=usuario).values_list("metodo", flat=True).first() or ""


def estado(usuario):
    factor = SegundoFactor.objects.filter(usuario=usuario).first()
    return {
        "activo": bool(factor and factor.metodo),
        "metodo": factor.metodo if factor else "",
        "metodo_nombre": factor.get_metodo_display() if factor and factor.metodo else "",
        "activado_en": factor.activado_en if factor and factor.metodo else None,
        "codigos_respaldo_restantes": len(factor.codigos_respaldo) if factor and factor.metodo else 0,
        "correo": usuario.email,
        "correo_verificado": usuario.correo_verificado,
    }


def _codigo_vigente(factor, ahora):
    """Hay un código enviado, sin usar, que aún no vence ni agotó sus intentos."""
    return bool(factor.codigo_correo and factor.codigo_vence and ahora <= factor.codigo_vence
                and factor.codigo_intentos < CODIGO_CORREO_INTENTOS)


def _enviar_codigo_correo(factor, proposito):
    ahora = timezone.now()
    # La espera solo aplica si el código anterior sigue sirviendo (si ya se usó o venció, sale uno nuevo de inmediato)
    if (_codigo_vigente(factor, ahora) and factor.codigo_enviado_en
            and (ahora - factor.codigo_enviado_en).total_seconds() < ESPERA_REENVIO_SEGUNDOS):
        raise ReglaNegocioError("Ya te enviamos un código. Espera un minuto antes de pedir otro.",
                                codigo="espera_reenvio", status=429)
    codigo = "".join(secrets.choice("0123456789") for _ in range(DIGITOS))
    factor.codigo_correo = _resumen(codigo)
    factor.codigo_vence = ahora + timedelta(minutes=CODIGO_CORREO_MINUTOS)
    factor.codigo_enviado_en = ahora
    factor.codigo_intentos = 0
    factor.save(update_fields=["codigo_correo", "codigo_vence", "codigo_enviado_en", "codigo_intentos"])
    correo.enviar_al_confirmar(
        correo.enviar_codigo_verificacion, factor.usuario, codigo, proposito=proposito, minutos_validez=CODIGO_CORREO_MINUTOS,
    )


def _codigo_correo_valido(factor, codigo):
    """Compara con el código enviado; cada intento fallido cuenta y al agotarlos hay que pedir otro."""
    if not factor.codigo_correo or not factor.codigo_vence:
        return False
    if timezone.now() > factor.codigo_vence or factor.codigo_intentos >= CODIGO_CORREO_INTENTOS:
        raise CodigoInvalido("El código venció o agotó sus intentos. Pide uno nuevo.", "codigo_vencido")
    if hmac.compare_digest(factor.codigo_correo, _resumen(codigo)):
        factor.codigo_correo, factor.codigo_vence, factor.codigo_intentos = "", None, 0
        factor.save(update_fields=["codigo_correo", "codigo_vence", "codigo_intentos"])
        return True
    factor.codigo_intentos += 1
    factor.save(update_fields=["codigo_intentos"])
    return False


def _activar(factor, nuevo_metodo, **campos):
    visibles, resumenes = _nuevos_codigos_respaldo()
    factor.metodo = nuevo_metodo
    factor.codigos_respaldo = resumenes
    factor.activado_en = timezone.now()
    factor.fallos, factor.bloqueado_hasta = 0, None
    for campo, valor in campos.items():
        setattr(factor, campo, valor)
    factor.save()
    correo.enviar_al_confirmar(correo.enviar_aviso_seguridad, factor.usuario, "activo", metodo=factor.get_metodo_display())
    return visibles


def _exigir_inactivo(factor):
    from ..sitio.demo import es_cuenta_demo

    if es_cuenta_demo(factor.usuario.email):
        # Las comparte todo el que prueba el sistema: con 2FA, una persona dejaría a las demás por fuera
        raise ReglaNegocioError("Las cuentas de demostración no usan la verificación en dos pasos.",
                                codigo="cuenta_demo", status=403)
    if factor.metodo:
        raise ReglaNegocioError("La verificación en dos pasos ya está activa. Desactívala para cambiar de método.",
                                codigo="2fa_ya_activa", status=409)


# ---------- Activación ----------

def iniciar_totp(usuario):
    """Genera la clave pendiente y el QR; no cambia nada hasta confirmar un código con activar_totp."""
    factor = factor_de(usuario)
    _exigir_inactivo(factor)
    factor.clave_pendiente = nueva_clave()
    factor.save(update_fields=["clave_pendiente"])
    return configuracion_totp(usuario, factor.clave_pendiente)


def configuracion_totp(usuario, clave):
    """QR, clave y URI para mostrar en pantalla (el portal la vuelve a pintar con la clave pendiente)."""
    uri = uri_otpauth(usuario, clave)
    return {"clave": clave, "clave_agrupada": clave_agrupada(clave), "uri": uri, "qr": qr_svg(uri), "emisor": EMISOR}


def clave_pendiente(usuario):
    return SegundoFactor.objects.filter(usuario=usuario, metodo="").values_list("clave_pendiente", flat=True).first() or ""


def activar_totp(usuario, codigo):
    """Confirma que la app quedó bien configurada y devuelve los códigos de respaldo (se muestran una sola vez)."""
    factor = factor_de(usuario)
    _exigir_inactivo(factor)
    if not factor.clave_pendiente:
        raise ReglaNegocioError("Primero escanea el código QR con tu app.", codigo="sin_clave_pendiente")
    paso = paso_del_codigo(factor.clave_pendiente, _normalizar(codigo))
    if paso is None:
        raise CodigoInvalido("El código no coincide. Revisa que la hora de tu celular sea la correcta.")
    return _activar(factor, SegundoFactor.Metodo.TOTP, clave_totp=factor.clave_pendiente, clave_pendiente="",
                    ultimo_paso=paso)


def iniciar_correo(usuario):
    factor = factor_de(usuario)
    _exigir_inactivo(factor)
    if not usuario.correo_verificado:
        raise ReglaNegocioError("Confirma tu correo antes de usarlo para la verificación en dos pasos.",
                                codigo="correo_sin_confirmar", status=409)
    _enviar_codigo_correo(factor, "activar")


def activar_correo(usuario, codigo):
    factor = factor_de(usuario)
    _exigir_inactivo(factor)
    if not _codigo_correo_valido(factor, _normalizar(codigo)):
        raise CodigoInvalido()
    return _activar(factor, SegundoFactor.Metodo.CORREO, clave_totp="", clave_pendiente="", ultimo_paso=0)


def _exigir_clave(usuario, contrasena):
    if not usuario.check_password(contrasena or ""):
        raise ReglaNegocioError("La contraseña no es correcta.", codigo="contrasena_incorrecta", status=400)


def desactivar(usuario, contrasena):
    _exigir_clave(usuario, contrasena)
    factor = SegundoFactor.objects.filter(usuario=usuario).first()
    if not factor or not factor.metodo:
        raise ReglaNegocioError("La verificación en dos pasos no está activa.", codigo="2fa_inactiva", status=409)
    nombre = factor.get_metodo_display()
    factor.delete()  # sin claves ni códigos guardados
    correo.enviar_al_confirmar(correo.enviar_aviso_seguridad, usuario, "inactivo", metodo=nombre)


MOTIVO_MINIMO = 20


def quitar_por_administracion(actor, usuario, motivo):
    """
    Para quien perdió el celular y los códigos de respaldo (R-11). Reglas:
      - el motivo es obligatorio (queda en la auditoría y se le envía a la persona);
      - nadie quita la suya por aquí (la propia se desactiva en Seguridad con la contraseña);
      - solo si quien lo hace tiene todos los permisos del rol de esa cuenta (no se baja la seguridad de alguien
        con más acceso).
    Devuelve (nombre del método que tenía, motivo normalizado).
    """
    from .models import Rol
    from .servicios import _exige_permisos_de

    motivo = " ".join((motivo or "").split())
    if len(motivo) < MOTIVO_MINIMO:
        raise ReglaNegocioError(
            f"Explica el motivo (mínimo {MOTIVO_MINIMO} caracteres): por ejemplo, cómo se comprobó la identidad de la persona.",
            codigo="motivo_requerido",
        )
    if usuario.pk == actor.pk:
        raise ReglaNegocioError("Tu propia verificación se desactiva en Mi cuenta → Seguridad, con tu contraseña.",
                                codigo="cuenta_propia", status=403)
    rol = Rol.objects.filter(codigo=usuario.rol).first()
    if rol:
        _exige_permisos_de(actor, rol.permisos_efectivos, f"quitar la verificación de una cuenta con el rol «{rol.nombre}»")
    factor = SegundoFactor.objects.filter(usuario=usuario).exclude(metodo="").first()
    if factor is None:
        raise ReglaNegocioError("Esta cuenta no tiene la verificación en dos pasos activa.", codigo="2fa_inactiva", status=409)
    nombre = factor.get_metodo_display()
    factor.delete()
    correo.enviar_al_confirmar(correo.enviar_aviso_seguridad, usuario, "quitado", metodo=nombre, motivo=motivo)
    return nombre, motivo


def regenerar_codigos(usuario, contrasena):
    _exigir_clave(usuario, contrasena)
    factor = SegundoFactor.objects.filter(usuario=usuario).exclude(metodo="").first()
    if factor is None:
        raise ReglaNegocioError("La verificación en dos pasos no está activa.", codigo="2fa_inactiva", status=409)
    visibles, factor.codigos_respaldo = _nuevos_codigos_respaldo()
    factor.save(update_fields=["codigos_respaldo"])
    correo.enviar_al_confirmar(correo.enviar_aviso_seguridad, usuario, "codigos", metodo=factor.get_metodo_display())
    return visibles


# ---------- Inicio de sesión (paso 2) ----------

def crear_desafio(usuario):
    """Tras la contraseña correcta: firma el desafío del paso 2 y, si el método es correo, envía el código."""
    factor = SegundoFactor.objects.get(usuario=usuario)
    if factor.metodo == SegundoFactor.Metodo.CORREO:
        try:
            _enviar_codigo_correo(factor, "iniciar")
        except ReglaNegocioError:
            pass  # ya hay uno vigente enviado hace menos de un minuto: sirve el mismo
    # La huella de la contraseña invalida el desafío si la contraseña cambia entre los dos pasos
    return signing.dumps({"u": usuario.pk, "h": _resumen(usuario.password)[:16]}, salt=SAL_DESAFIO, compress=True)


def usuario_del_desafio(desafio):
    try:
        datos = signing.loads(desafio or "", salt=SAL_DESAFIO, max_age=DESAFIO_SEGUNDOS)
    except signing.SignatureExpired:
        raise ReglaNegocioError("Pasaron más de 5 minutos. Vuelve a escribir tu correo y contraseña.",
                                codigo="desafio_vencido", status=400)
    except signing.BadSignature:
        raise ReglaNegocioError("La verificación no es válida. Vuelve a iniciar sesión.", codigo="desafio_invalido",
                                status=400)
    usuario = Usuario.objects.filter(pk=datos.get("u"), is_active=True).first()
    if usuario is None or _resumen(usuario.password)[:16] != datos.get("h") or not activo(usuario):
        raise ReglaNegocioError("La verificación no es válida. Vuelve a iniciar sesión.", codigo="desafio_invalido",
                                status=400)
    return usuario


def verificar(usuario, codigo):
    """
    Valida el código del paso 2: de la app, del correo o uno de respaldo (que se gasta). Tras FALLOS_PERMITIDOS
    intentos fallidos seguidos bloquea el paso 2 por BLOQUEO_MINUTOS. Devuelve True si se usó un código de respaldo.
    """
    # El error se lanza fuera de la transacción: así el intento fallido sí queda contado
    with transaction.atomic():
        usado_respaldo = _comprobar(usuario, _normalizar(codigo))
    if usado_respaldo is None:
        raise CodigoInvalido()
    return usado_respaldo


def _comprobar(usuario, limpio):
    """True/False = válido (con o sin código de respaldo); None = incorrecto (ya contado como fallo)."""
    factor = SegundoFactor.objects.select_for_update().get(usuario=usuario)
    ahora = timezone.now()
    if factor.bloqueado_hasta and ahora < factor.bloqueado_hasta:
        minutos = max(1, round((factor.bloqueado_hasta - ahora).total_seconds() / 60))
        raise ReglaNegocioError(f"Demasiados intentos fallidos. Inténtalo de nuevo en {minutos} minuto(s).",
                                codigo="2fa_bloqueada", status=429)
    usado_respaldo = False
    valido = False
    if len(limpio) == DIGITOS and limpio.isdigit():
        if factor.metodo == SegundoFactor.Metodo.TOTP:
            paso = paso_del_codigo(factor.clave_totp, limpio, factor.ultimo_paso)
            if paso is not None:
                factor.ultimo_paso, valido = paso, True
        else:
            valido = _codigo_correo_valido(factor, limpio)
    elif limpio and _resumen(limpio) in factor.codigos_respaldo:
        factor.codigos_respaldo = [c for c in factor.codigos_respaldo if c != _resumen(limpio)]
        valido = usado_respaldo = True
    if not valido:
        factor.fallos += 1
        if factor.fallos >= FALLOS_PERMITIDOS:
            factor.fallos, factor.bloqueado_hasta = 0, ahora + timedelta(minutes=BLOQUEO_MINUTOS)
        factor.save(update_fields=["fallos", "bloqueado_hasta"])
        return None
    factor.fallos, factor.bloqueado_hasta = 0, None
    factor.save(update_fields=["ultimo_paso", "codigos_respaldo", "fallos", "bloqueado_hasta"])
    return usado_respaldo


def reenviar_codigo(usuario):
    factor = SegundoFactor.objects.get(usuario=usuario)
    if factor.metodo != SegundoFactor.Metodo.CORREO:
        raise ReglaNegocioError("Tu cuenta usa una app autenticadora: abre la app para ver el código.",
                                codigo="metodo_sin_reenvio", status=409)
    _enviar_codigo_correo(factor, "iniciar")
