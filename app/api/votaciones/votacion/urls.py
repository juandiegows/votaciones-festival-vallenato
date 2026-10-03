from django.urls import path

from . import views

rutas_publicas = [
    ("ediciones", views.EdicionPublicaViewSet, "edicion"),
    ("categorias", views.CategoriaPublicaViewSet, "categoria"),
    ("votaciones", views.VotacionPublicaViewSet, "votacion"),
    ("opciones", views.OpcionPublicaViewSet, "opcion"),
]

rutas_gestion = [
    ("ediciones", views.AdminEdicionViewSet, "admin-edicion"),
    ("categorias", views.AdminCategoriaViewSet, "admin-categoria"),
    ("votaciones", views.AdminVotacionViewSet, "admin-votacion"),
    ("opciones", views.AdminOpcionViewSet, "admin-opcion"),
    ("votos", views.AdminVotoViewSet, "admin-voto"),
]

urlpatterns = [
    path("mis-votos/", views.MisVotosView.as_view(), name="mis-votos"),
]
