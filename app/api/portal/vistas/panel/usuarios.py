"""Usuarios registrados: buscar, filtrar por rol y asignar cualquier rol (reglas en cuentas.servicios.cambiar_rol)."""

from django.contrib import messages
from django.core.paginator import Paginator
from django.db.models import Q
from django.shortcuts import get_object_or_404, redirect
from django.views.decorators.http import require_POST

from votaciones.auditoria.mixins import auditar
from votaciones.comun.errores import ReglaNegocioError
from votaciones.cuentas import servicios, servicios_2fa
from votaciones.cuentas.models import SegundoFactor
from votaciones.cuentas.models import Rol
from votaciones.models import Usuario
from votaciones.sitio.demo import es_cuenta_demo

from .base import edicion_panel, render_panel, requiere_permiso

POR_PAGINA = 25


def roles_asignables(actor, roles):
    """Roles que quien edita puede dar o quitar: nadie reparte permisos que no tiene (la regla está en el servicio)."""
    return [rol for rol in roles if rol.permisos_efectivos <= actor.permisos]


@requiere_permiso("usuarios.ver")
def usuarios(request):
    busqueda = request.GET.get("q", "").strip()
    rol = request.GET.get("rol", "")
    roles = list(Rol.objects.all())
    nombres = {r.codigo: r.nombre for r in roles}
    consulta = Usuario.objects.select_related("segundo_factor").order_by("rol", "email")
    if busqueda:
        consulta = consulta.filter(Q(email__icontains=busqueda) | Q(nombres__icontains=busqueda) | Q(apellidos__icontains=busqueda))
    if rol in nombres:
        consulta = consulta.filter(rol=rol)
    asignables = roles_asignables(request.user, roles) if request.user.tiene_permiso("usuarios.cambiar_rol") else []
    codigos_asignables = {r.codigo for r in asignables}
    pagina = Paginator(consulta, POR_PAGINA).get_page(request.GET.get("pagina"))
    for usuario in pagina:
        usuario.es_demo = es_cuenta_demo(usuario.email)
        usuario.rol_nombre = nombres.get(usuario.rol, usuario.rol)
        usuario.rol_editable = usuario.pk != request.user.pk and usuario.rol in codigos_asignables
        try:
            usuario.dos_pasos = usuario.segundo_factor.get_metodo_display() if usuario.segundo_factor.metodo else ""
        except SegundoFactor.DoesNotExist:
            usuario.dos_pasos = ""
    return render_panel(request, "portal/panel/usuarios.html", "usuarios", edicion_panel(request), {
        "pagina": pagina, "busqueda": busqueda, "motivo_minimo": servicios_2fa.MOTIVO_MINIMO, "rol": rol, "roles": roles, "roles_asignables": asignables,
        "total_admins": Usuario.objects.filter(rol=Usuario.Rol.ADMINISTRADOR, is_active=True).count(),
    })


@requiere_permiso("usuarios.ver", editar="usuarios.cambiar_rol")
@require_POST
def cambiar_rol(request, pk):
    usuario = get_object_or_404(Usuario, pk=pk)
    anterior = usuario.rol
    try:
        servicios.cambiar_rol(request.user, usuario, request.POST.get("rol", ""))
    except ReglaNegocioError as error:
        messages.warning(request, error.mensaje)
    else:
        if usuario.rol == anterior:
            messages.info(request, f"{usuario.email} ya tenía ese rol.")
        else:
            nombre = Rol.objects.filter(codigo=usuario.rol).values_list("nombre", flat=True).first() or usuario.rol
            auditar(request, "cambiar_rol", "usuario", usuario.pk, {"email": usuario.email, "rol": usuario.rol, "anterior": anterior})
            messages.success(request, f"{usuario.email} ahora tiene el rol «{nombre}».")
    volver = request.POST.get("volver", "")
    return redirect(volver if volver.startswith("/panel/usuarios") else "portal:panel-usuarios")


@requiere_permiso("usuarios.ver", editar="usuarios.quitar_2fa")
@require_POST
def quitar_2fa(request, pk):
    """Quita la verificación en dos pasos de otra cuenta (R-11): exige un motivo que queda en la auditoría."""
    usuario = get_object_or_404(Usuario, pk=pk)
    try:
        metodo, motivo = servicios_2fa.quitar_por_administracion(request.user, usuario, request.POST.get("motivo", ""))
    except ReglaNegocioError as error:
        messages.warning(request, error.mensaje)
    else:
        auditar(request, "quitar_2fa", "usuario", usuario.pk, {"email": usuario.email, "metodo": metodo, "motivo": motivo})
        messages.success(request, f"Quitaste la verificación en dos pasos de {usuario.email}. Le enviamos un aviso con el motivo.")
    volver = request.POST.get("volver", "")
    return redirect(volver if volver.startswith("/panel/usuarios") else "portal:panel-usuarios")
