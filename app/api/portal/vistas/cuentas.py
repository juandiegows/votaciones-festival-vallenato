"""Registro, inicio y cierre de sesión con el sistema de autenticación de Django (sesión en cookie)."""

from django.contrib import messages
from django.contrib.auth import login, logout
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render
from django.urls import reverse
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.http import require_POST

from votaciones.comun.errores import ReglaNegocioError
from votaciones.cuentas import servicios
from votaciones.sitio.models import ConfiguracionSitio

from ..catalogos import CREDENCIALES_DEMO
from ..formularios import LoginForm, RegistroForm


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
        login(request, usuario, backend="django.contrib.auth.backends.ModelBackend")
        messages.success(request, f"¡Bienvenido, {usuario.nombres}! Tu cuenta fue creada. "
                                  f"Te enviamos un enlace a {usuario.email} para confirmar tu correo.")
        return redirect(destino_seguro(request, reverse("portal:categorias")))
    return render(request, "portal/registro.html", {
        "form": form, "pedir_documento": pedir_documento,
        "siguiente": request.POST.get("next") or request.GET.get("next", ""),
    })


def iniciar_sesion(request):
    if request.user.is_authenticated:
        return redirect("portal:inicio")
    form = LoginForm(request.POST or None, request=request)
    if request.method == "POST" and form.is_valid():
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


@login_required
@require_POST
def reenviar_confirmacion(request):
    try:
        servicios.reenviar_confirmacion(request.user)
        messages.success(request, f"Te enviamos un nuevo enlace a {request.user.email}.")
    except ReglaNegocioError as error:
        messages.info(request, error.mensaje)
    return redirect(destino_seguro(request, reverse("portal:inicio")))
