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
    if nombre in ("mis-votos", "comprobante"):
        return "mis-votos"
    return nombre if nombre in ("inicio", "equipo") else ""


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
        # Acceso al panel (cualquier rol con panel.ver) y permisos del rol para mostrar u ocultar acciones
        "es_admin": usuario.is_authenticated and usuario.accede_panel,
        "permisos": usuario.permisos if usuario.is_authenticated else frozenset(),
        # El login exhibe las cuentas demo solo si el setting lo deja, se permite su ingreso y no se apagó su exhibición
        "mostrar_credenciales_demo": (settings.MOSTRAR_CREDENCIALES_DEMO and configuracion.permitir_cuentas_demo
                                      and configuracion.mostrar_credenciales_demo),
        "menu_activo": menu_activo(request),
    }
