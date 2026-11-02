"""Votos y resultados: conteos por opción y quién participó. El voto es secreto: nunca se cruzan votante y opción."""

from django.core.paginator import Paginator
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404

from votaciones.models import Categoria, Votacion, Voto
from votaciones.votacion import reportes

from .base import edicion_panel, render_panel, solo_administrador


COMPROBANTES_POR_PAGINA = 25


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
    lista = list(listar(edicion, categoria)) if edicion else []
    return render_panel(request, "portal/panel/votos.html", "votos", edicion, {
        "lista": lista, "total_votos": sum(v.num_votos for v in lista), "filtro_categoria": categoria,
        "categorias": Categoria.objects.filter(edicion=edicion).order_by("orden", "nombre") if edicion else [],
    })


@solo_administrador
def detalle(request, pk):
    votacion = get_object_or_404(Votacion.objects.select_related("categoria__edicion"), pk=pk)
    resultados = reportes.calcular_resultados(votacion)
    maximo = max((fila["votos"] for fila in resultados["resultados"]), default=0)
    for fila in resultados["resultados"]:
        fila["lider"] = maximo > 0 and fila["votos"] == maximo
    # Voto secreto: el comprobante va con su opción, nunca con el votante, y en orden de código (no de llegada)
    codigo = request.GET.get("codigo", "").strip()
    comprobantes = Voto.objects.filter(votacion=votacion).select_related("opcion").order_by("codigo_comprobante")
    if codigo:
        comprobantes = comprobantes.filter(codigo_comprobante__icontains=codigo)
    return render_panel(request, "portal/panel/votos_detalle.html", "votos", edicion_panel(request), {
        "votacion": votacion,
        "resultados": resultados,
        "participacion": reportes.participacion(votacion),
        "codigo": codigo,
        "comprobantes": Paginator(comprobantes, COMPROBANTES_POR_PAGINA).get_page(request.GET.get("pagina")),
    })
