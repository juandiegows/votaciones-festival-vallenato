"""CRUD de categorías de la edición elegida, con búsqueda, filtro por estado y activar/desactivar."""

from django.contrib import messages
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404, redirect
from django.views.decorators.http import require_POST

from votaciones.models import Categoria, Edicion, Votacion

from ...catalogos import ICONOS_DISPONIBLES
from ...formularios import CategoriaForm
from .base import (
    alternar_activa, avisar_guardado, bloqueo_por_hijos, edicion_panel, eliminar, es_formulario_nuevo, guardar,
    render_panel, solo_administrador,
)


def valores_nueva_categoria(edicion):
    abierta = edicion if edicion and edicion.estado != Edicion.Estado.CERRADA else None
    orden = Categoria.objects.filter(edicion=edicion).count() + 1
    return {"edicion": abierta, "icono": "music-note-beamed", "activa": True, "orden": orden}


def abiertas_por_categoria(edicion):
    """{categoria_id: votaciones abiertas}. El estado depende de la hora, por eso se calcula en Python."""
    conteo = {}
    for v in Votacion.objects.filter(categoria__edicion=edicion, publicada=True).select_related("categoria__edicion"):
        if v.estado == Votacion.Estado.ABIERTA:
            conteo[v.categoria_id] = conteo.get(v.categoria_id, 0) + 1
    return conteo


def listar(edicion, busqueda, estado):
    consulta = Categoria.objects.filter(edicion=edicion).annotate(num_votaciones=Count("votaciones")).order_by("orden", "nombre")
    if busqueda:
        consulta = consulta.filter(Q(nombre__icontains=busqueda) | Q(descripcion__icontains=busqueda) | Q(slug__icontains=busqueda))
    if estado in ("activa", "inactiva"):
        consulta = consulta.filter(activa=estado == "activa")
    abiertas = abiertas_por_categoria(edicion)
    lista = list(consulta)
    for categoria in lista:
        categoria.num_abiertas = abiertas.get(categoria.pk, 0)
    return lista


@solo_administrador
def categorias(request, pk=None):
    edicion = edicion_panel(request)
    instancia = get_object_or_404(Categoria, pk=pk) if pk else None
    form = None
    if instancia or es_formulario_nuevo(request, "panel-categoria-nueva"):
        inicial = None if instancia else valores_nueva_categoria(edicion)
        form = CategoriaForm(request.POST or None, request.FILES or None, instance=instancia, initial=inicial)
        if request.method == "POST" and form.is_valid():
            avisar_guardado(request, "categoria", *guardar(request, form, "categoria"))
            return redirect("portal:panel-categorias")
    busqueda, estado = request.GET.get("q", "").strip(), request.GET.get("estado", "")
    return render_panel(request, "portal/panel/categorias.html", "categorias", edicion, {
        "lista": listar(edicion, busqueda, estado), "form": form, "instancia": instancia,
        "busqueda": busqueda, "filtro_estado": estado, "iconos": ICONOS_DISPONIBLES,
        "hay_categorias": Categoria.objects.filter(edicion=edicion).exists(),
        "hay_ediciones_abiertas": Edicion.objects.exclude(estado=Edicion.Estado.CERRADA).exists(),
    })


@solo_administrador
@require_POST
def alternar_categoria(request, pk):
    categoria = get_object_or_404(Categoria, pk=pk)
    activa = alternar_activa(request, categoria, "categoria")
    estado = "activada" if activa else "desactivada: ya no se muestra al público"
    messages.info(request, f"Categoría «{categoria.nombre}» {estado}.")
    return redirect("portal:panel-categorias")


@solo_administrador
@require_POST
def eliminar_categoria(request, pk):
    objeto = get_object_or_404(Categoria, pk=pk)
    if not bloqueo_por_hijos(request, objeto, objeto.votaciones.count(), "votación(es); puedes desactivarla"):
        eliminar(request, objeto, "categoria")
    return redirect("portal:panel-categorias")
