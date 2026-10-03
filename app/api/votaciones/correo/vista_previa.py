"""
Vista previa de las plantillas de correo con datos de ejemplo (solo con DEBUG). Nada se guarda ni se envía.
  /api/correo/vista-previa/                      índice
  /api/correo/vista-previa/<plantilla>/          HTML del correo
  /api/correo/vista-previa/<plantilla>/?formato=txt   versión de texto
"""

from datetime import date

from django.http import Http404, HttpResponse
from django.templatetags.static import static
from django.utils import timezone
from django.utils.html import escape

from ..cuentas.models import Usuario
from ..votacion.models import Categoria, Edicion, Opcion, Votacion, Voto
from . import servicio
from .adaptadores.memoria import AdaptadorMemoria


def datos_demo():
    usuario = Usuario(email="votante@festival.test", nombres="Valentina", apellidos="Ospino Carrillo")
    edicion = Edicion(nombre="Festival de la Leyenda Vallenata 2027", anio=2027,
                      fecha_inicio=date(2027, 4, 28), fecha_fin=date(2027, 5, 1))
    categoria = Categoria(edicion=edicion, nombre="Piloneras", slug="piloneras")
    votacion = Votacion(categoria=categoria, titulo="Mejor comparsa de Piloneras", slug="mejor-comparsa-de-piloneras")
    opcion = Opcion(votacion=votacion, nombre="Comparsa Las Marías del Valle")
    voto = Voto(usuario=usuario, votacion=votacion, opcion=opcion, codigo_comprobante="FLV27-M5FV8T",
                fecha_hora=timezone.now())
    return usuario, voto


def plantillas():
    usuario, voto = datos_demo()
    base = servicio.url_sitio()
    return {
        "bienvenida": ("Bienvenida", lambda **o: servicio.enviar_bienvenida(usuario, **o)),
        "confirmar_correo": ("Confirmar correo", lambda **o: servicio.enviar_confirmacion_correo(
            usuario, f"{base}/confirmar-correo?token=demo", **o)),
        "comprobante_voto": ("Comprobante de voto", lambda **o: servicio.enviar_comprobante_voto(voto, **o)),
        "restablecer_clave": ("Restablecer contraseña", lambda **o: servicio.enviar_restablecer_clave(
            usuario, f"{base}/restablecer-clave?token=demo", **o)),
    }


def vista_previa(request, plantilla=None):
    disponibles = plantillas()
    if plantilla is None:
        enlaces = "".join(
            f'<li><a href="{clave}/">{titulo}</a> · <a href="{clave}/?formato=txt">texto</a></li>'
            for clave, (titulo, _) in disponibles.items()
        )
        return HttpResponse(f"<!doctype html><meta charset=utf-8><title>Correos</title>"
                            f"<h1>Plantillas de correo</h1><ul>{enlaces}</ul>")
    if plantilla not in disponibles:
        raise Http404("Plantilla no encontrada")
    memoria = AdaptadorMemoria()
    disponibles[plantilla][1](adaptador=memoria, silencioso=False)
    mensaje = memoria.mensajes[0]
    # El navegador no entiende cid: (imagen incrustada); en la vista previa el logo sale de los estáticos de la API
    mensaje.html = mensaje.html.replace(
        f"cid:{servicio.CID_LOGO}", request.build_absolute_uri(static("correo/acordeon.png"))
    )
    if request.GET.get("formato") == "txt":
        return HttpResponse(f"<!doctype html><meta charset=utf-8><pre>Asunto: {escape(mensaje.asunto)}\n\n"
                            f"{escape(mensaje.texto)}</pre>")
    return HttpResponse(mensaje.html)
