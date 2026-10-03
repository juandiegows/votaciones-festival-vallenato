"""Mapa del sitio (sitemap.xml) con las páginas públicas de la web.

La web es una SPA: sus rutas por edición, categoría y votación salen de la base de datos, así que el mapa lo
arma la API con las mismas reglas de visibilidad del sitio público (RN-13, RN-14). robots.txt de la web lo
declara en /api/sitemap.xml.
"""

from datetime import timedelta
from xml.sax.saxutils import escape

from django.conf import settings
from django.http import HttpResponse
from django.utils import timezone
from django.views.decorators.cache import cache_page
from django.views.decorators.http import require_GET

from ..votacion.models import Categoria, Edicion, Votacion
from .models import ConfiguracionSitio

# Páginas fijas indexables (login, mis votos, comprobantes y el panel quedan fuera: son privadas o no aportan)
PAGINAS_FIJAS = [("/", "daily", "1.0"), ("/registro", "monthly", "0.5")]


def url_sitio():
    return settings.CORREO_URL_SITIO.rstrip("/")


def _cerrada_visible(votacion, dias, ahora):
    """RN-13: una votación cerrada sigue visible los días configurados (None = siempre)."""
    if votacion.estado_en(ahora) != Votacion.Estado.CERRADA or dias is None:
        return True
    return votacion.fecha_cierre + timedelta(days=dias) > ahora


def entradas_sitemap():
    """(ruta, lastmod, changefreq, priority) de cada página pública."""
    ahora = timezone.now()
    entradas = [(ruta, None, frecuencia, prioridad) for ruta, frecuencia, prioridad in PAGINAS_FIJAS]
    dias = ConfiguracionSitio.obtener().dias_visible_cerradas
    # RN-14: solo la edición activa se muestra en el sitio público
    for edicion in Edicion.objects.filter(estado=Edicion.Estado.ACTIVA).order_by("-anio"):
        entradas.append((f"/{edicion.anio}", None, "daily", "0.9"))
        categorias = Categoria.objects.filter(edicion=edicion, activa=True).order_by("orden", "nombre")
        for categoria in categorias:
            ruta_categoria = f"/{edicion.anio}/categorias/{categoria.slug}"
            votaciones = [
                v for v in Votacion.objects.filter(categoria=categoria, publicada=True).order_by("fecha_apertura")
                if _cerrada_visible(v, dias, ahora)
            ]
            ultima = max((v.actualizada_en for v in votaciones), default=None)
            entradas.append((ruta_categoria, ultima, "daily", "0.8"))
            for votacion in votaciones:
                frecuencia = "hourly" if votacion.estado_en(ahora) == Votacion.Estado.ABIERTA else "weekly"
                entradas.append((f"{ruta_categoria}/{votacion.slug}", votacion.actualizada_en, frecuencia, "0.7"))
    return entradas


@require_GET
@cache_page(60 * 15)
def sitemap(request):
    base = url_sitio()
    lineas = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for ruta, lastmod, frecuencia, prioridad in entradas_sitemap():
        lineas.append("  <url>")
        lineas.append(f"    <loc>{escape(base + ruta)}</loc>")
        if lastmod:
            lineas.append(f"    <lastmod>{lastmod.date().isoformat()}</lastmod>")
        lineas.append(f"    <changefreq>{frecuencia}</changefreq>")
        lineas.append(f"    <priority>{prioridad}</priority>")
        lineas.append("  </url>")
    lineas.append("</urlset>")
    return HttpResponse("\n".join(lineas) + "\n", content_type="application/xml; charset=utf-8")
