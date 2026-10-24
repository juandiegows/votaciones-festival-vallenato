"""CRUD de las opciones de una votación (/panel/votaciones/<id>/opciones)."""

from django.contrib import messages
from django.db.models import Count
from django.shortcuts import get_object_or_404, redirect
from django.views.decorators.http import require_POST

from votaciones.models import Opcion, Votacion
from votaciones.votacion import servicios

from ...formularios import OpcionForm
from .base import alternar_activa, avisar_guardado, eliminar, es_formulario_nuevo, guardar, render_panel, solo_administrador

# RN-19: desde que la votación abre, nadie puede cambiar a qué opción cuentan los votos
MENSAJE_BLOQUEO = "Las opciones no se pueden cambiar: la votación está abierta, cerrada o ya tiene votos."


def regla_eliminacion(opcion):
    servicios.validar_cambio_opciones(opcion.votacion)
    servicios.validar_eliminacion(opcion)


@solo_administrador
def opciones(request, votacion_pk, pk=None):
    votacion = get_object_or_404(Votacion.objects.select_related("categoria__edicion"), pk=votacion_pk)
    instancia = get_object_or_404(Opcion, pk=pk, votacion=votacion) if pk else None
    bloqueada = servicios.opciones_bloqueadas(votacion)
    form = None
    if instancia or es_formulario_nuevo(request, "panel-opcion-nueva"):
        if bloqueada:
            messages.warning(request, MENSAJE_BLOQUEO)
            return redirect("portal:panel-opciones", votacion_pk=votacion.pk)
        inicial = None if instancia else {"orden": votacion.opciones.count() + 1, "activa": True}
        form = OpcionForm(request.POST or None, request.FILES or None,
                          instance=instancia or Opcion(votacion=votacion), initial=inicial)
        if request.method == "POST" and form.is_valid():
            avisar_guardado(request, "opcion", *guardar(request, form, "opcion"))
            return redirect("portal:panel-opciones", votacion_pk=votacion.pk)
    lista = list(votacion.opciones.annotate(num_votos=Count("votos")).order_by("orden", "id"))
    return render_panel(request, "portal/panel/opciones.html", "votaciones", votacion.categoria.edicion, {
        "votacion": votacion, "lista": lista, "form": form, "instancia": instancia, "bloqueada": bloqueada,
        "activas": sum(1 for o in lista if o.activa),
    })


@solo_administrador
@require_POST
def alternar_opcion(request, votacion_pk, pk):
    opcion = get_object_or_404(Opcion.objects.select_related("votacion"), pk=pk, votacion_id=votacion_pk)
    if servicios.opciones_bloqueadas(opcion.votacion):
        messages.warning(request, MENSAJE_BLOQUEO)
        return redirect("portal:panel-opciones", votacion_pk=votacion_pk)
    activa = alternar_activa(request, opcion, "opcion")
    messages.info(request, f"Opción «{opcion.nombre}» {'activada' if activa else 'desactivada'}.")
    return redirect("portal:panel-opciones", votacion_pk=votacion_pk)


@solo_administrador
@require_POST
def eliminar_opcion(request, votacion_pk, pk):
    eliminar(request, get_object_or_404(Opcion.objects.select_related("votacion"), pk=pk, votacion_id=votacion_pk), "opcion",
             regla_eliminacion)
    return redirect("portal:panel-opciones", votacion_pk=votacion_pk)
