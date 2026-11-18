from django.urls import path

from . import views

rutas_gestion = [
    ("registros", views.AdminRegistrosViewSet, "admin-registros"),
]

urlpatterns = [
    path("registros/web/", views.ErrorClienteView.as_view(), name="registros-web"),
]
