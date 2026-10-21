"""Procesador de contexto: datos que usan todas las plantillas del portal (menú, pie de página y marca)."""

from django.conf import settings

from votaciones.sitio.models import ConfiguracionSitio, RedSocial
from votaciones.votacion import selectores

# Rutas que no usan las plantillas del portal: no se consulta la base de datos de más
RUTAS_SIN_PORTAL = ("/api/", "/django-admin/", "/media/", "/static/")


def colores_marca(configuracion):
    """Colores personalizados en /panel/marca (solo los que difieren de la marca base) como variables CSS."""
    colores = (configuracion.marca or {}).get("colores") or {}
    return {token: valor for token, valor in colores.items() if str(token).startswith("--flv-")}


def menu_activo(request):
    """Entrada del menú principal resaltada según la ruta."""
    nombre = getattr(request.resolver_match, "url_name", "") or ""
    if nombre.startswith("panel"):
        return "panel"
    if nombre in ("edicion", "categoria", "votacion"):
        return "categorias"
    return "inicio" if nombre == "inicio" else ""


def sitio(request):
    if request.path.startswith(RUTAS_SIN_PORTAL):
        return {}
    configuracion = ConfiguracionSitio.obtener()
    usuario = request.user
    return {
        "edicion_activa": selectores.edicion_activa(),
        "configuracion": configuracion,
        "redes": RedSocial.objects.filter(activa=True),
        "colores_marca": colores_marca(configuracion),
        "es_admin": usuario.is_authenticated and usuario.es_administrador,
        "modo_desarrollo": settings.DEBUG,
        "menu_activo": menu_activo(request),
    }
