"""
Roles y permisos (/panel/roles): cada funcionalidad del panel es un permiso y un rol es un conjunto de permisos.
Las reglas (roles fijos, nadie edita su propio rol ni reparte permisos que no tiene) viven en cuentas.servicios.
"""

from django.contrib import messages
from django.db.models import Count
from django.shortcuts import get_object_or_404, redirect
from django.views.decorators.http import require_POST

from votaciones.auditoria.mixins import auditar
from votaciones.comun.errores import ReglaNegocioError
from votaciones.cuentas import permisos as catalogo
from votaciones.cuentas import servicios
from votaciones.cuentas.models import Rol
from votaciones.models import Usuario

from ...formularios import RolForm
from .base import edicion_panel, es_formulario_nuevo, render_panel, requiere_permiso


def listar():
    usuarios = dict(Usuario.objects.values("rol").annotate(total=Count("id")).values_list("rol", "total"))
    lista = list(Rol.objects.all())
    for rol in lista:
        rol.num_usuarios = usuarios.get(rol.codigo, 0)
        rol.num_permisos = len(rol.permisos_efectivos)
        # Para consultarlos sin abrir el formulario (quien solo tiene roles.ver)
        rol.grupos = [g for g in catalogo.grupos_con_estado(rol.permisos_efectivos) if any(p["activo"] for p in g["permisos"])]
    return lista


@requiere_permiso("roles.ver", crear="roles.gestionar", editar="roles.gestionar")
def roles(request, pk=None):
    instancia = get_object_or_404(Rol, pk=pk) if pk else None
    form = None
    if instancia and instancia.codigo == request.user.rol and request.method == "GET":
        # Solo interfaz: no se ofrece el formulario del rol propio (si se envía igual, el servicio lo rechaza)
        messages.warning(request, "No puedes editar tu propio rol: pídeselo a otro usuario que gestione roles.")
        return redirect("portal:panel-roles")
    if instancia or es_formulario_nuevo(request, "panel-rol-nuevo"):
        form = RolForm(request.POST or None, rol=instancia)
        if request.method == "POST" and form.is_valid():
            try:
                rol = servicios.guardar_rol(request.user, form.datos(), rol=instancia)
            except ReglaNegocioError as error:
                messages.warning(request, error.mensaje)
                return redirect("portal:panel-roles")
            auditar(request, "actualizar" if instancia else "crear", "rol", rol.pk,
                    {"nombre": rol.nombre, "codigo": rol.codigo, "permisos": sorted(rol.permisos_efectivos)})
            messages.success(request, f"Rol «{rol.nombre}» {'actualizado' if instancia else 'creado'} correctamente.")
            return redirect("portal:panel-roles")
    marcados = (form.data.getlist("permisos") if form.is_bound else form.initial.get("permisos", [])) if form else []
    return render_panel(request, "portal/panel/roles.html", "roles", edicion_panel(request), {
        "lista": listar(), "form": form, "instancia": instancia,
        "grupos_form": catalogo.grupos_con_estado(marcados) if form else [],
    })


@requiere_permiso("roles.ver", editar="roles.gestionar")
@require_POST
def eliminar_rol(request, pk):
    rol = get_object_or_404(Rol, pk=pk)
    nombre, rol_pk, codigo = rol.nombre, rol.pk, rol.codigo
    try:
        servicios.eliminar_rol(request.user, rol)
    except ReglaNegocioError as error:
        messages.warning(request, error.mensaje)
    else:
        auditar(request, "eliminar", "rol", rol_pk, {"nombre": nombre, "codigo": codigo})
        messages.success(request, f"Rol «{nombre}» eliminado.")
    return redirect("portal:panel-roles")
