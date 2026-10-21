"""CRUD de ediciones. Solo puede haber una activa: al activar una, las demás se cierran."""

from django.contrib import messages
from django.db.models import Count, Max
from django.shortcuts import get_object_or_404, redirect
from django.utils import timezone
from django.views.decorators.http import require_POST

from votaciones.models import Edicion
from votaciones.votacion import servicios

from ...catalogos import PRESENTACIONES_CATEGORIAS
from ...formularios import EdicionForm
from .base import (
    avisar_guardado, bloqueo_por_hijos, edicion_panel, eliminar, es_formulario_nuevo, guardar, render_panel,
    solo_administrador,
)


def valores_nueva_edicion():
    siguiente = (Edicion.objects.aggregate(m=Max("anio"))["m"] or timezone.localdate().year) + 1
    return {"nombre": f"Festival de la Leyenda Vallenata {siguiente}", "anio": siguiente, "estado": Edicion.Estado.CERRADA}


@solo_administrador
def ediciones(request, pk=None):
    instancia = get_object_or_404(Edicion, pk=pk) if pk else None
    form = None
    if instancia or es_formulario_nuevo(request, "panel-edicion-nueva"):
        form = EdicionForm(request.POST or None, instance=instancia, initial=None if instancia else valores_nueva_edicion())
        if request.method == "POST" and form.is_valid():
            objeto, nuevo = guardar(request, form, "edicion")
            avisar_guardado(request, "edicion", objeto, nuevo)
            cerradas = servicios.cerrar_otras_ediciones(objeto)
            if cerradas:
                messages.info(request, f"Se cerraron {cerradas} edición(es) que estaban activas: solo puede haber una.")
            return redirect("portal:panel-ediciones")
    return render_panel(request, "portal/panel/ediciones.html", "ediciones", edicion_panel(request), {
        "lista": Edicion.objects.annotate(num_categorias=Count("categorias")).order_by("-anio"),
        "form": form, "instancia": instancia, "presentaciones": PRESENTACIONES_CATEGORIAS,
    })


@solo_administrador
@require_POST
def eliminar_edicion(request, pk):
    objeto = get_object_or_404(Edicion, pk=pk)
    if not bloqueo_por_hijos(request, objeto, objeto.categorias.count(), "categoría(s)"):
        eliminar(request, objeto, "edicion")
    return redirect("portal:panel-ediciones")
