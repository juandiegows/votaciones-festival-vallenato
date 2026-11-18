"""
Verificación en dos pasos en el sitio MVT (RF-20, CU-15): paso 2 del inicio de sesión (/verificar-acceso) y la página
«Mi cuenta → Seguridad» (/cuenta/seguridad). Las reglas están en votaciones/cuentas/servicios_2fa.py.
"""

from django.contrib import messages
from django.contrib.auth import login
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render
from django.urls import reverse
from django.views.decorators.http import require_http_methods

from votaciones.auditoria.mixins import auditar
from votaciones.comun.errores import ReglaNegocioError
from votaciones.cuentas import servicios_2fa
from votaciones.sitio.demo import es_cuenta_demo

SESION_DESAFIO = "dos_pasos_desafio"
SESION_SIGUIENTE = "dos_pasos_siguiente"
SESION_CONFIGURANDO = "dos_pasos_configurando"
SESION_CODIGOS = "dos_pasos_codigos"
BACKEND = "votaciones.sitio.demo.AutenticacionConCuentasDemo"


def pedir_segundo_paso(request, usuario, siguiente):
    """La contraseña fue correcta pero la cuenta tiene 2FA: guarda el desafío en la sesión y pide el código."""
    request.session[SESION_DESAFIO] = servicios_2fa.crear_desafio(usuario)
    request.session[SESION_SIGUIENTE] = siguiente
    return redirect("portal:verificar-acceso")


def _terminar_desafio(request):
    request.session.pop(SESION_DESAFIO, None)
    return request.session.pop(SESION_SIGUIENTE, "")


@require_http_methods(["GET", "POST"])
def verificar_acceso(request):
    desafio = request.session.get(SESION_DESAFIO)
    if not desafio:
        return redirect("portal:login")
    try:
        usuario = servicios_2fa.usuario_del_desafio(desafio)
    except ReglaNegocioError as error:
        _terminar_desafio(request)
        messages.error(request, error.mensaje)
        return redirect("portal:login")

    metodo = servicios_2fa.metodo(usuario)
    error = None
    if request.method == "POST":
        if "reenviar" in request.POST:
            try:
                servicios_2fa.reenviar_codigo(usuario)
                messages.success(request, f"Te enviamos un código nuevo a {usuario.email}.")
            except ReglaNegocioError as aviso:
                messages.info(request, aviso.mensaje)
            return redirect("portal:verificar-acceso")
        try:
            usado_respaldo = servicios_2fa.verificar(usuario, request.POST.get("codigo", ""))
        except ReglaNegocioError as fallo:
            error = fallo.mensaje
        else:
            siguiente = _terminar_desafio(request)
            login(request, usuario, backend=BACKEND)
            if usado_respaldo:
                auditar(request, "usar_codigo_respaldo_2fa", "usuario", usuario.pk)
                restantes = servicios_2fa.estado(usuario)["codigos_respaldo_restantes"]
                messages.warning(request, f"Entraste con un código de respaldo. Te quedan {restantes}: "
                                          "genera nuevos en Mi cuenta → Seguridad si te quedan pocos.")
            por_defecto = reverse("portal:panel") if usuario.accede_panel else reverse("portal:categorias")
            return redirect(siguiente or por_defecto)
    return render(request, "portal/verificar_acceso.html", {
        "metodo": metodo, "correo": usuario.email, "error": error, "minutos": servicios_2fa.CODIGO_CORREO_MINUTOS,
    })


ACCIONES_CONFIGURAR = {"iniciar_totp", "activar_totp", "iniciar_correo", "activar_correo", "cancelar"}


def _ejecutar(request, accion):
    """Aplica la acción del formulario; devuelve el mensaje de error o None."""
    usuario = request.user
    if accion == "iniciar_totp":
        servicios_2fa.iniciar_totp(usuario)
        request.session[SESION_CONFIGURANDO] = "totp"
    elif accion == "iniciar_correo":
        servicios_2fa.iniciar_correo(usuario)
        request.session[SESION_CONFIGURANDO] = "correo"
        messages.success(request, f"Te enviamos un código a {usuario.email}.")
    elif accion in ("activar_totp", "activar_correo"):
        activar = servicios_2fa.activar_totp if accion == "activar_totp" else servicios_2fa.activar_correo
        request.session[SESION_CODIGOS] = activar(usuario, request.POST.get("codigo", ""))
        request.session.pop(SESION_CONFIGURANDO, None)
        auditar(request, "activar_2fa", "usuario", usuario.pk, {"metodo": accion.removeprefix("activar_")})
        messages.success(request, "La verificación en dos pasos quedó activa.")
    elif accion == "cancelar":
        request.session.pop(SESION_CONFIGURANDO, None)
    elif accion == "regenerar":
        request.session[SESION_CODIGOS] = servicios_2fa.regenerar_codigos(usuario, request.POST.get("password", ""))
        auditar(request, "regenerar_codigos_2fa", "usuario", usuario.pk)
        messages.success(request, "Generaste nuevos códigos de respaldo: los anteriores ya no sirven.")
    elif accion == "desactivar":
        servicios_2fa.desactivar(usuario, request.POST.get("password", ""))
        auditar(request, "desactivar_2fa", "usuario", usuario.pk)
        messages.info(request, "Desactivaste la verificación en dos pasos.")


@login_required
@require_http_methods(["GET", "POST"])
def seguridad(request):
    usuario = request.user
    error = None
    if request.method == "POST":
        accion = request.POST.get("accion", "")
        try:
            _ejecutar(request, accion)
            return redirect("portal:seguridad")
        except ReglaNegocioError as fallo:
            error = fallo.mensaje
            if accion in ("iniciar_correo", "iniciar_totp"):
                request.session.pop(SESION_CONFIGURANDO, None)

    estado = servicios_2fa.estado(usuario)
    configurando = "" if estado["activo"] else request.session.get(SESION_CONFIGURANDO, "")
    totp = None
    if configurando == "totp":
        clave = servicios_2fa.clave_pendiente(usuario)
        if clave:
            totp = servicios_2fa.configuracion_totp(usuario, clave)
        else:
            configurando = ""
    return render(request, "portal/seguridad.html", {
        "estado": estado, "configurando": configurando, "totp": totp, "error": error,
        # Los códigos de respaldo se muestran una sola vez (al recargar ya no están)
        "codigos": request.session.pop(SESION_CODIGOS, None),
        "es_demo": es_cuenta_demo(usuario.email), "minutos": servicios_2fa.CODIGO_CORREO_MINUTOS,
        "menu_activo": "seguridad",
    })
