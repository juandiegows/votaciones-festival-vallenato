"""Usuarios registrados: buscar y cambiar el rol (hacer administrador o devolver a votante)."""

from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Q
from django.shortcuts import get_object_or_404, redirect
from django.views.decorators.http import require_POST

from votaciones.auditoria.mixins import auditar
from votaciones.comun.errores import ReglaNegocioError
from votaciones.cuentas import servicios
from votaciones.models import Usuario
from votaciones.sitio.demo import es_cuenta_demo

from .base import edicion_panel, render_panel, solo_administrador

POR_PAGINA = 25


@solo_administrador
def usuarios(request):
    busqueda = request.GET.get("q", "").strip()
    rol = request.GET.get("rol", "")
    consulta = Usuario.objects.order_by("rol", "email")  # «administrador» antes que «votante»
    if busqueda:
        consulta = consulta.filter(Q(email__icontains=busqueda) | Q(nombres__icontains=busqueda) | Q(apellidos__icontains=busqueda))
    if rol in Usuario.Rol.values:
        consulta = consulta.filter(rol=rol)
    pagina = Paginator(consulta, POR_PAGINA).get_page(request.GET.get("pagina"))
    for usuario in pagina:
        usuario.es_demo = es_cuenta_demo(usuario.email)
    return render_panel(request, "portal/panel/usuarios.html", "usuarios", edicion_panel(request), {
        "pagina": pagina, "busqueda": busqueda, "rol": rol,
        "total_admins": Usuario.objects.filter(rol=Usuario.Rol.ADMINISTRADOR, is_active=True).count(),
    })


@solo_administrador
@require_POST
def cambiar_rol(request, pk):
    usuario = get_object_or_404(Usuario, pk=pk)
    try:
        servicios.cambiar_rol(request.user, usuario, request.POST.get("rol", ""))
    except ReglaNegocioError as error:
        messages.warning(request, error.mensaje)
    else:
        auditar(request, "cambiar_rol", "usuario", usuario.pk, {"email": usuario.email, "rol": usuario.rol})
        texto = "ahora es administrador" if usuario.rol == Usuario.Rol.ADMINISTRADOR else "volvió a ser votante"
        messages.success(request, f"{usuario.email} {texto}.")
    volver = request.POST.get("volver", "")
    return redirect(volver if volver.startswith("/panel/usuarios") else "portal:panel-usuarios")
