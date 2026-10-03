from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

publico = DefaultRouter()
publico.register("ediciones", views.EdicionPublicaViewSet, basename="edicion")
publico.register("categorias", views.CategoriaPublicaViewSet, basename="categoria")
publico.register("votaciones", views.VotacionPublicaViewSet, basename="votacion")
publico.register("opciones", views.OpcionPublicaViewSet, basename="opcion")

admin = DefaultRouter()
admin.register("ediciones", views.AdminEdicionViewSet, basename="admin-edicion")
admin.register("categorias", views.AdminCategoriaViewSet, basename="admin-categoria")
admin.register("votaciones", views.AdminVotacionViewSet, basename="admin-votacion")
admin.register("opciones", views.AdminOpcionViewSet, basename="admin-opcion")
admin.register("votos", views.AdminVotoViewSet, basename="admin-voto")
admin.register("usuarios", views.AdminUsuarioViewSet, basename="admin-usuario")
admin.register("banners", views.AdminBannerViewSet, basename="admin-banner")
admin.register("revistas", views.AdminRevistaViewSet, basename="admin-revista")
admin.register("redes", views.AdminRedSocialViewSet, basename="admin-red")
admin.register("auditoria", views.AdminAuditoriaViewSet, basename="admin-auditoria")

urlpatterns = [
    path("auth/registro/", views.RegistroView.as_view(), name="auth-registro"),
    path("auth/login/", views.LoginView.as_view(), name="auth-login"),
    path("auth/logout/", views.LogoutView.as_view(), name="auth-logout"),
    path("auth/yo/", views.PerfilView.as_view(), name="auth-yo"),
    path("auth/confirmar-correo/", views.ConfirmarCorreoView.as_view(), name="auth-confirmar-correo"),
    path("auth/reenviar-confirmacion/", views.ReenviarConfirmacionView.as_view(), name="auth-reenviar-confirmacion"),
    path("mis-votos/", views.MisVotosView.as_view(), name="mis-votos"),
    path("sitio/", views.SitioView.as_view(), name="sitio"),
    # Administración bajo /api/gestion/: el WAF de producción (Cloudflare) bloquea cualquier ruta con /admin.
    # /api/admin/ se conserva como alias (pruebas y clientes antiguos) y no aparece en el esquema OpenAPI.
    path("gestion/configuracion/", views.AdminConfiguracionView.as_view(), name="admin-configuracion"),
    path("gestion/", include(admin.urls)),
    path("admin/configuracion/", views.AdminConfiguracionView.as_view(), name="admin-configuracion-alias"),
    path("admin/", include((admin.urls, "alias-admin"))),
    path("", include(publico.urls)),
]
