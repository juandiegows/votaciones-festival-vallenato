from django.urls import path

from . import views

rutas_gestion = [
    ("usuarios", views.AdminUsuarioViewSet, "admin-usuario"),
    ("roles", views.AdminRolViewSet, "admin-rol"),
]

urlpatterns = [
    path("auth/registro/", views.RegistroView.as_view(), name="auth-registro"),
    path("auth/login/", views.LoginView.as_view(), name="auth-login"),
    path("auth/logout/", views.LogoutView.as_view(), name="auth-logout"),
    path("auth/yo/", views.PerfilView.as_view(), name="auth-yo"),
    path("auth/confirmar-correo/", views.ConfirmarCorreoView.as_view(), name="auth-confirmar-correo"),
    path("auth/documento/", views.CompletarDocumentoView.as_view(), name="auth-documento"),
    path("auth/reenviar-confirmacion/", views.ReenviarConfirmacionView.as_view(), name="auth-reenviar-confirmacion"),
    # Verificación en dos pasos (RF-20)
    path("auth/2fa/", views.EstadoDosPasosView.as_view(), name="auth-2fa"),
    path("auth/2fa/totp/iniciar/", views.IniciarTotpView.as_view(), name="auth-2fa-totp-iniciar"),
    path("auth/2fa/totp/activar/", views.ActivarTotpView.as_view(), name="auth-2fa-totp-activar"),
    path("auth/2fa/correo/iniciar/", views.IniciarCorreoView.as_view(), name="auth-2fa-correo-iniciar"),
    path("auth/2fa/correo/activar/", views.ActivarCorreoView.as_view(), name="auth-2fa-correo-activar"),
    path("auth/2fa/desactivar/", views.DesactivarDosPasosView.as_view(), name="auth-2fa-desactivar"),
    path("auth/2fa/codigos-respaldo/", views.RegenerarCodigosView.as_view(), name="auth-2fa-codigos"),
    path("auth/2fa/verificar/", views.VerificarDosPasosView.as_view(), name="auth-2fa-verificar"),
    path("auth/2fa/reenviar/", views.ReenviarCodigoDosPasosView.as_view(), name="auth-2fa-reenviar"),
]
