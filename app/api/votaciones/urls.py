"""
Rutas /api/… de la app. Cada módulo declara sus rutas (urlpatterns) y sus ViewSets públicos (rutas_publicas) y de
administración (rutas_gestion); aquí se registran en dos routers para no repetir la raíz del API en cada módulo.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .auditoria import urls as auditoria
from .cuentas import urls as cuentas
from .sitio import urls as sitio
from .votacion import urls as votacion

MODULOS = [votacion, cuentas, sitio, auditoria]


def router(nombre_rutas):
    enrutador = DefaultRouter()
    for modulo in MODULOS:
        for prefijo, viewset, basename in getattr(modulo, nombre_rutas, []):
            enrutador.register(prefijo, viewset, basename=basename)
    return enrutador


publico = router("rutas_publicas")
gestion = router("rutas_gestion")

urlpatterns = [
    *cuentas.urlpatterns,
    *votacion.urlpatterns,
    *sitio.urlpatterns,
    # Administración bajo /api/gestion/: el WAF de producción (Cloudflare) bloquea cualquier ruta con /admin.
    # /api/admin/ se conserva como alias (pruebas y clientes antiguos) y no aparece en el esquema OpenAPI.
    path("gestion/", include(gestion.urls)),
    path("admin/", include((gestion.urls, "alias-admin"))),
    path("", include(publico.urls)),
]
