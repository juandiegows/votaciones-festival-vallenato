from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

publico = DefaultRouter()
publico.register("ediciones", views.EdicionPublicaViewSet, basename="edicion")
publico.register("categorias", views.CategoriaPublicaViewSet, basename="categoria")
publico.register("votaciones", views.VotacionPublicaViewSet, basename="votacion")

admin = DefaultRouter()
admin.register("ediciones", views.AdminEdicionViewSet, basename="admin-edicion")
admin.register("categorias", views.AdminCategoriaViewSet, basename="admin-categoria")
admin.register("votaciones", views.AdminVotacionViewSet, basename="admin-votacion")
admin.register("opciones", views.AdminOpcionViewSet, basename="admin-opcion")
admin.register("auditoria", views.AdminAuditoriaViewSet, basename="admin-auditoria")

urlpatterns = [
    path("auth/registro/", views.RegistroView.as_view(), name="auth-registro"),
    path("auth/login/", views.LoginView.as_view(), name="auth-login"),
    path("auth/logout/", views.LogoutView.as_view(), name="auth-logout"),
    path("auth/yo/", views.PerfilView.as_view(), name="auth-yo"),
    path("mis-votos/", views.MisVotosView.as_view(), name="mis-votos"),
    path("admin/", include(admin.urls)),
    path("", include(publico.urls)),
]
