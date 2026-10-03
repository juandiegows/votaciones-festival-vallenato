"""
Correos transaccionales del sistema. Las vistas solo llaman a enviar_bienvenida, enviar_confirmacion_correo,
enviar_comprobante_voto o enviar_restablecer_clave; el proveedor real (SMTP, ZeptoMail…) lo elige
CORREO_ADAPTADOR y se resuelve en obtener_adaptador().
"""

import logging
import re

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.module_loading import import_string

from ..models import ConfiguracionSitio
from .adaptadores import AdaptadorCorreo, Destinatario, ErrorEnvioCorreo, Mensaje

logger = logging.getLogger("votaciones.correo")

# Igual que app/web/src/components/Avatar.jsx: [fondo, texto] con contraste AA
COLORES_AVATAR = [
    ("#DD3333", "#FFFFFF"),
    ("#000000", "#D7AC70"),
    ("#D7AC70", "#000000"),
    ("#7D2710", "#FFFFFF"),
    ("#1C1711", "#E9D294"),
]


def avatar(nombre):
    """Iniciales y color de la opción, calculados como en la web para que el correo coincida con la pantalla."""
    limpio = re.sub(r"\(.*?\)", "", nombre)
    limpio = re.sub(r"^(Canción|Propuesta|Participante)\s+\S+\s*[–-]?\s*", "", limpio, flags=re.I)
    limpio = re.sub(r"^(Comparsa|Agrupación|Conjunto|Semillero)\s+", "", limpio, flags=re.I)
    palabras = [p for p in re.split(r"[\s–-]+", re.sub(r"['’]", "", limpio)) if len(p) > 2]
    iniciales = ((palabras[0][0] if palabras else "?") + (palabras[1][0] if len(palabras) > 1 else "")).upper()
    hash_ = 0
    for caracter in nombre:
        hash_ = (hash_ * 31 + ord(caracter)) & 0xFFFFFFFF
    fondo, texto = COLORES_AVATAR[hash_ % len(COLORES_AVATAR)]
    return {"iniciales": iniciales, "fondo": fondo, "texto": texto}


def url_sitio():
    return settings.CORREO_URL_SITIO.rstrip("/")


def obtener_adaptador() -> AdaptadorCorreo:
    """Instancia el adaptador configurado en CORREO_ADAPTADOR (lee la configuración en cada envío)."""
    ruta = settings.CORREO_ADAPTADORES.get(settings.CORREO_ADAPTADOR)
    if not ruta:
        raise ImproperlyConfigured(
            f"CORREO_ADAPTADOR «{settings.CORREO_ADAPTADOR}» no existe. "
            f"Opciones: {', '.join(settings.CORREO_ADAPTADORES)}."
        )
    return import_string(ruta)()


def contexto_base():
    sitio = ConfiguracionSitio.obtener()
    return {
        "organizacion": sitio.nombre_organizacion,
        "correo_contacto": sitio.correo,
        "telefono_contacto": sitio.telefono,
        "direccion": sitio.direccion,
        "texto_pie": sitio.texto_pie,
        "url_sitio": url_sitio(),
        "url_sitio_corta": re.sub(r"^https?://", "", url_sitio()),
        "url_recursos": (settings.CORREO_URL_RECURSOS or f"{url_sitio()}/correo").rstrip("/"),
        "anio_actual": timezone.localdate().year,
    }


def enviar_plantilla(plantilla, usuario, asunto, contexto=None, silencioso=True, adaptador=None):
    """
    Renderiza correo/<plantilla>.html y .txt y lo envía al usuario. Con silencioso=True un fallo del proveedor
    se registra en el log y no interrumpe la operación (registro, voto…); devuelve True si se envió.
    adaptador: reemplaza al configurado (la vista previa usa uno que solo guarda el mensaje).
    """
    contexto = {**contexto_base(), "usuario": usuario, "asunto": asunto, **(contexto or {})}
    mensaje = Mensaje(
        para=[Destinatario(usuario.email, f"{usuario.nombres} {usuario.apellidos}".strip())],
        asunto=asunto,
        html=render_to_string(f"correo/{plantilla}.html", contexto),
        texto=render_to_string(f"correo/{plantilla}.txt", contexto),
        remitente=Destinatario(settings.CORREO_REMITENTE, settings.CORREO_REMITENTE_NOMBRE),
        responder_a=settings.CORREO_RESPONDER_A,
        etiquetas={"plantilla": plantilla},
    )
    try:
        (adaptador or obtener_adaptador()).enviar(mensaje)
    except ErrorEnvioCorreo:
        if not silencioso:
            raise
        logger.exception("No se pudo enviar el correo «%s» a %s", plantilla, usuario.email)
        return False
    return True


def enviar_bienvenida(usuario, **opciones):
    return enviar_plantilla(
        "bienvenida", usuario, "Te damos la bienvenida a las votaciones del Festival Vallenato",
        {"enlace": url_sitio()}, **opciones,
    )


def enviar_confirmacion_correo(usuario, enlace, horas_validez=48, **opciones):
    """enlace: URL de la web que confirma el correo (con el token ya incluido)."""
    return enviar_plantilla(
        "confirmar_correo", usuario, "Confirma tu correo para empezar a votar",
        {"enlace": enlace, "horas_validez": horas_validez}, **opciones,
    )


def enviar_comprobante_voto(voto, **opciones):
    votacion = voto.votacion
    edicion = votacion.categoria.edicion
    return enviar_plantilla(
        "comprobante_voto", voto.usuario, f"Comprobante de tu voto · {voto.codigo_comprobante}",
        {
            "voto": voto,
            "votacion": votacion,
            "categoria": votacion.categoria,
            "edicion": edicion,
            "fecha_hora": timezone.localtime(voto.fecha_hora),
            "avatar": avatar(voto.opcion.nombre),
            # Mismas rutas que app/web/src/hooks/useRutas.js
            "enlace_imprimir": (
                f"{url_sitio()}/{edicion.anio}/categorias/{votacion.categoria.slug}/{votacion.slug}/comprobante?imprimir=1"
            ),
            "enlace_mis_votos": f"{url_sitio()}/mis-votos",
            "enlace_seguir": f"{url_sitio()}/{edicion.anio}",
        },
        **opciones,
    )


def enviar_restablecer_clave(usuario, enlace, minutos_validez=60, **opciones):
    """enlace: URL de la web para escribir la nueva contraseña (con el token ya incluido)."""
    return enviar_plantilla(
        "restablecer_clave", usuario, "Restablece tu contraseña",
        {"enlace": enlace, "minutos_validez": minutos_validez}, **opciones,
    )
