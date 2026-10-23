"""Etiquetas y filtros de las plantillas: equivalen a los componentes pequeños de la web React."""

import re

from django import template
from django.templatetags.static import static
from django.utils import timezone
from django.utils.html import format_html

from votaciones.correo.servicio import avatar as datos_avatar

from ..catalogos import ESTADOS, PRESENTACIONES_CATEGORIAS, PRESENTACIONES_OPCIONES, VISIBILIDAD

register = template.Library()

MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"]

@register.filter
def fecha(valor):
    """28 abr 2027 (formato es-CO de la web)."""
    if not valor:
        return "—"
    return f"{valor.day} {MESES[valor.month - 1]} {valor.year}"


@register.filter
def fecha_hora(valor):
    """28 abr 2027, 8:00 a. m."""
    if not valor:
        return "—"
    local = timezone.localtime(valor)
    hora = local.hour % 12 or 12
    sufijo = "a. m." if local.hour < 12 else "p. m."
    return f"{fecha(local)}, {hora}:{local.minute:02d} {sufijo}"


@register.filter
def iso(valor):
    return timezone.localtime(valor).isoformat() if valor else ""


@register.filter
def miles(valor):
    """1.234 (separador de miles es-CO)."""
    return f"{int(valor or 0):,}".replace(",", ".")


@register.filter
def plural(numero, formas):
    """{{ n|plural:"votación,votaciones" }} → «1 votación» / «3 votaciones»."""
    singular, varias = formas.split(",")
    return f"{numero} {singular if numero == 1 else varias}"


@register.filter
def visibilidad(valor):
    return VISIBILIDAD.get(valor, valor)


@register.filter
def presentacion_categorias(valor):
    return next((p for p in PRESENTACIONES_CATEGORIAS if p["valor"] == valor), PRESENTACIONES_CATEGORIAS[0])


@register.filter
def presentacion_opciones(valor):
    return next((p for p in PRESENTACIONES_OPCIONES if p["valor"] == valor), PRESENTACIONES_OPCIONES[0])


@register.simple_tag
def estado_badge(estado):
    e = ESTADOS.get(estado, ESTADOS["programada"])
    return format_html(
        '<span class="badge badge-estado {}"><i class="bi bi-{} me-1" aria-hidden="true"></i>{}</span>',
        e["clase"], e["icono"], e["etiqueta"],
    )


URL_ICONO = "https://icons.getbootstrap.com/icons/"


def icono_desde_url(url):
    """La votación guarda su ícono de Bootstrap Icons como URL en el campo `imagen` (igual que la API y la web)."""
    return url[len(URL_ICONO):].strip("/") if url and url.startswith(URL_ICONO) else ""


@register.filter
def icono_votacion(votacion):
    return icono_desde_url(votacion.imagen) or votacion.categoria.icono


@register.simple_tag
def icono_entidad(icono="", imagen=None, clase=""):
    """Imagen subida por el administrador o, si no hay, el ícono de Bootstrap Icons elegido (decorativo)."""
    if imagen:
        return format_html('<img src="{}" alt="" aria-hidden="true" class="icono-entidad-img {}" loading="lazy">', imagen.url, clase)
    return format_html('<i class="bi bi-{} {}" aria-hidden="true"></i>', icono or "check2-square", clase)


@register.simple_tag
def avatar(nombre, tamano=56):
    """Avatar SVG con iniciales sobre un color derivado del nombre (sin fotos externas)."""
    datos = datos_avatar(nombre)  # mismas iniciales y color que la web React y los correos
    circulo = "#000000" if datos["fondo"] == "#DD3333" else "#DD3333"
    return format_html(
        '<span class="d-inline-flex flex-shrink-0" style="width:{0}px;height:{0}px">'
        '<svg viewBox="0 0 56 56" width="{0}" height="{0}" role="img" aria-label="Imagen ilustrativa de {1}">'
        '<rect width="56" height="56" rx="14" fill="{2}"/>'
        '<circle cx="46" cy="10" r="14" fill="{3}" opacity=".35"/>'
        '<path d="M0 44 Q14 36 28 44 T56 44 V56 H0Z" fill="#000" opacity=".12"/>'
        '<text x="28" y="35" text-anchor="middle" font-family="Poppins, sans-serif" font-weight="700" font-size="19" fill="{4}">{5}</text>'
        "</svg></span>",
        tamano, nombre, datos["fondo"], circulo, datos["texto"], datos["iniciales"],
    )


@register.filter
def url_medio(opcion):
    """Audio subido o enlace multimedia. Las muestras /audio/… de la web viven en los estáticos del portal."""
    if opcion.audio:
        return opcion.audio.url
    enlace = opcion.enlace_multimedia or ""
    if enlace.startswith("/audio/"):
        return static("portal" + enlace)
    return enlace


@register.filter
def es_audio(url):
    return bool(re.search(r"\.(mp3|ogg|wav|m4a|webm)(\?.*)?$", url or "", re.I))


@register.filter
def tiene_medio(opcion):
    return bool(opcion.audio or opcion.enlace_multimedia or opcion.texto_audio)


@register.filter
def letra(indice):
    """0 → A, 1 → B… (presentación «respuestas»); después de la Z sigue con números."""
    return chr(65 + indice) if 0 <= indice < 26 else str(indice + 1)


@register.filter
def campo_invalido(campo):
    """Clase de Bootstrap para un campo de formulario con errores."""
    return " is-invalid" if campo.errors else ""


@register.filter
def valor_fecha_hora(valor):
    """Valor para <input type="datetime-local">: hora local sin zona (o el texto tal como lo envió el usuario)."""
    if hasattr(valor, "hour"):
        return timezone.localtime(valor).strftime("%Y-%m-%dT%H:%M") if timezone.is_aware(valor) else valor.strftime("%Y-%m-%dT%H:%M")
    return valor or ""
