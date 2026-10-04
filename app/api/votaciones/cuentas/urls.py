from django.urls import path

from . import views

rutas_gestion = [
    ("usuarios", views.AdminUsuarioViewSet, "admin-usuario"),
]

urlpatterns = [
    path("auth/registro/", views.RegistroView.as_view(), name="auth-registro"),
    path("auth/login/", views.LoginView.as_view(), name="auth-login"),
    path("auth/logout/", views.LogoutView.as_view(), name="auth-logout"),
    path("auth/yo/", views.PerfilView.as_view(), name="auth-yo"),
    path("auth/confirmar-correo/", views.ConfirmarCorreoView.as_view(), name="auth-confirmar-correo"),
    path("auth/documento/", views.CompletarDocumentoView.as_view(), name="auth-documento"),
    path("auth/reenviar-confirmacion/", views.ReenviarConfirmacionView.as_view(), name="auth-reenviar-confirmacion"),
]
