"""Detalle de votaciones: conteos por opción y quién participó. El voto es secreto: nunca se cruzan votante y opción."""

from django.db.models import Count, Q
from django.shortcuts import get_object_or_404

from votaciones.models import Categoria, Votacion
from votaciones.votacion import reportes

from .base import edicion_panel, render_panel, solo_administrador


def listar(edicion, categoria):
    consulta = (
        Votacion.objects.filter(categoria__edicion=edicion, publicada=True).select_related("categoria__edicion")
        .annotate(num_votos=Count("votos", distinct=True), num_opciones=Count("opciones", filter=Q(opciones__activa=True), distinct=True))
        .order_by("categoria__orden", "fecha_apertura")
    )
    return consulta.filter(categoria_id=categoria) if categoria.isdigit() else consulta


@solo_administrador
def votos(request):
    edicion = edicion_panel(request)
    categoria = request.GET.get("categoria", "")
    return render_panel(request, "portal/panel/votos.html", "votos", edicion, {
        "lista": listar(edicion, categoria) if edicion else [], "filtro_categoria": categoria,
        "categorias": Categoria.objects.filter(edicion=edicion).order_by("orden", "nombre") if edicion else [],
    })


@solo_administrador
def detalle(request, pk):
    votacion = get_object_or_404(Votacion.objects.select_related("categoria__edicion"), pk=pk)
    return render_panel(request, "portal/panel/votos_detalle.html", "votos", edicion_panel(request), {
        "votacion": votacion,
        "resultados": reportes.calcular_resultados(votacion),
        "participacion": reportes.participacion(votacion),
    })
