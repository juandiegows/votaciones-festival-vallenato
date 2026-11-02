"""
Registro, inicio y cierre de sesión, confirmación del correo y recuperación de contraseña con el sistema de
autenticación de Django (sesión en cookie).
"""

import time

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import login, logout
from django.contrib.auth.tokens import default_token_generator
from django.contrib.auth.views import PasswordResetConfirmView
from django.shortcuts import redirect, render
from django.urls import reverse, reverse_lazy
from django.utils.encoding import force_bytes
from django.utils.http import url_has_allowed_host_and_scheme, urlsafe_base64_encode
from django.views.decorators.http import require_POST

from votaciones import correo
from votaciones.comun.errores import ReglaNegocioError
from votaciones.cuentas import servicios
from votaciones.models import Usuario
from votaciones.sitio.models import ConfiguracionSitio

from ..catalogos import CREDENCIALES_DEMO
from ..formularios import LoginForm, NuevaClaveForm, RecuperarClaveForm, RegistroForm

SESION_CORREO_PENDIENTE = "correo_pendiente"
SESION_ULTIMO_REENVIO = "ultimo_reenvio_confirmacion"
ESPERA_REENVIO_SEGUNDOS = 60


def destino_seguro(request, por_defecto):
    """`next` solo si apunta a este mismo sitio (evita redirecciones abiertas)."""
    destino = request.POST.get("next") or request.GET.get("next")
    if destino and url_has_allowed_host_and_scheme(destino, {request.get_host()}, require_https=request.is_secure()):
        return destino
    return por_defecto


def registro(request):
    if request.user.is_authenticated:
        return redirect("portal:categorias")
    pedir_documento = ConfiguracionSitio.obtener().pedir_documento
    form = RegistroForm(request.POST or None, pedir_documento=pedir_documento)
    if request.method == "POST" and form.is_valid():
        usuario = servicios.registrar_votante(**form.datos_cuenta())
        request.session[SESION_CORREO_PENDIENTE] = usuario.pk
        return redirect("portal:revisa-tu-correo")
    return render(request, "portal/registro.html", {
        "form": form, "pedir_documento": pedir_documento,
        "siguiente": request.POST.get("next") or request.GET.get("next", ""),
    })


def iniciar_sesion(request):
    if request.user.is_authenticated:
        return redirect("portal:inicio")
    form = LoginForm(request.POST or None, request=request)
    if request.method == "POST" and form.is_valid():
        # Sin confirmar el correo no se entra (los administradores se crean ya verificados o por consola)
        if not form.usuario.correo_verificado and not form.usuario.es_administrador:
            request.session[SESION_CORREO_PENDIENTE] = form.usuario.pk
            return redirect("portal:revisa-tu-correo")
        login(request, form.usuario)
        por_defecto = reverse("portal:panel") if form.usuario.es_administrador else reverse("portal:categorias")
        return redirect(destino_seguro(request, por_defecto))
    return render(request, "portal/login.html", {
        "form": form,
        "siguiente": request.POST.get("next") or request.GET.get("next", ""),
        "credenciales_demo": CREDENCIALES_DEMO,
    })


@require_POST
def cerrar_sesion(request):
    logout(request)
    messages.info(request, "Cerraste tu sesión.")
    return redirect("portal:inicio")


def recuperar_clave(request):
    """Pide el correo y envía el enlace para crear una contraseña nueva (token de Django, de un solo uso)."""
    form = RecuperarClaveForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        usuario = Usuario.objects.filter(email=form.cleaned_data["email"].lower(), is_active=True).first()
        if usuario is not None:
            uid = urlsafe_base64_encode(force_bytes(usuario.pk))
            ruta = reverse("portal:restablecer-clave", args=[uid, default_token_generator.make_token(usuario)])
            correo.enviar_al_confirmar(
                correo.enviar_restablecer_clave, usuario, f"{correo.servicio.url_sitio()}{ruta}",
                minutos_validez=settings.PASSWORD_RESET_TIMEOUT // 60,
            )
        # El mismo mensaje exista o no la cuenta: así no se puede averiguar qué correos están registrados
        return render(request, "portal/recuperar_clave.html", {"enviado": True, "correo": form.cleaned_data["email"]})
    return render(request, "portal/recuperar_clave.html", {"form": form})


class RestablecerClave(PasswordResetConfirmView):
    """Destino del enlace del correo: valida el token y pide la contraseña nueva."""

    template_name = "portal/restablecer_clave.html"
    form_class = NuevaClaveForm
    success_url = reverse_lazy("portal:login")

    def form_valid(self, form):
        messages.success(self.request, "Tu contraseña se cambió. Ya puedes iniciar sesión con la nueva.")
        return super().form_valid(form)


def confirmar_correo(request):
    """Destino del enlace del correo de confirmación: /confirmar-correo?token=…"""
    token = request.GET.get("token", "")
    contexto = {"ok": False, "error": "El enlace de confirmación está incompleto."}
    if token:
        try:
            usuario, _ = servicios.confirmar_correo(token)
            contexto = {"ok": True, "correo": usuario.email}
        except ReglaNegocioError as error:
            contexto = {"ok": False, "error": error.mensaje}
    return render(request, "portal/confirmar_correo.html", contexto)


def usuario_por_confirmar(request):
    """Quien acaba de registrarse o intentó entrar sin confirmar; también sirve para sesiones ya iniciadas."""
    if request.user.is_authenticated:
        return request.user
    return Usuario.objects.filter(pk=request.session.get(SESION_CORREO_PENDIENTE), is_active=True).first()


def revisa_tu_correo(request):
    """Aviso tras el registro: la cuenta no se usa hasta abrir el enlace enviado al correo."""
    usuario = usuario_por_confirmar(request)
    if usuario is None or usuario.correo_verificado:
        return redirect("portal:login")
    return render(request, "portal/revisa_tu_correo.html", {"correo": usuario.email})


@require_POST
def reenviar_confirmacion(request):
    usuario = usuario_por_confirmar(request)
    if usuario is None:
        return redirect("portal:login")
    ahora = time.time()
    if ahora - request.session.get(SESION_ULTIMO_REENVIO, 0) < ESPERA_REENVIO_SEGUNDOS:
        messages.info(request, "Ya te enviamos un enlace. Espera un minuto antes de pedir otro.")
        return redirect(destino_seguro(request, reverse("portal:revisa-tu-correo")))
    try:
        servicios.reenviar_confirmacion(usuario)
        request.session[SESION_ULTIMO_REENVIO] = ahora
        messages.success(request, f"Te enviamos un nuevo enlace a {usuario.email}.")
    except ReglaNegocioError as error:
        messages.info(request, error.mensaje)
    return redirect(destino_seguro(request, reverse("portal:revisa-tu-correo")))
