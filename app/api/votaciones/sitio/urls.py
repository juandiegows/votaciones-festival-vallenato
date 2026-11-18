from django.urls import path

from . import views

rutas_gestion = [
    ("banners", views.AdminBannerViewSet, "admin-banner"),
    ("revistas", views.AdminRevistaViewSet, "admin-revista"),
    ("redes", views.AdminRedSocialViewSet, "admin-red"),
]

urlpatterns = [
    path("sitio/", views.SitioView.as_view(), name="sitio"),
    # Configuración del sitio (registro único, fuera del router); /api/admin/… es el alias local de /api/gestion/…
    path("gestion/configuracion/", views.AdminConfiguracionView.as_view(), name="admin-configuracion"),
    path("admin/configuracion/", views.AdminConfiguracionView.as_view(), name="admin-configuracion-alias"),
    path("gestion/demo/", views.AdminDemoView.as_view(), name="admin-demo"),
    path("gestion/demo/eliminar/", views.AdminDemoAccionView.as_view(accion="eliminar"), name="admin-demo-eliminar"),
    path("gestion/demo/cargar/", views.AdminDemoAccionView.as_view(accion="cargar"), name="admin-demo-cargar"),
]
