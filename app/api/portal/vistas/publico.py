"""Vistas públicas (MVT): leen MySQL con el ORM y entregan los datos a las plantillas de templates/portal/."""

from django.shortcuts import redirect, render
from django.utils import timezone

from votaciones.models import Categoria, Votacion
from votaciones.sitio import selectores as selectores_sitio
from votaciones.votacion import reportes, selectores

from .. import consultas
from ..catalogos import FILTROS_ESTADO, PASOS_INICIO
from .errores import pagina_error

MOTIVO_RESULTADOS = {
    Votacion.Visibilidad.AL_CIERRE: "Los resultados se publicarán cuando la votación cierre.",
    Votacion.Visibilidad.NO_PUBLICAR: "La organización decidió no publicar los resultados de esta votación.",
}


def inicio(request):
    edicion = selectores.edicion_activa()
    if edicion is None:
        return render(request, "portal/sin_edicion.html")
    contenido = selectores_sitio.contenido_publico()
    banners = list(contenido["banners"].order_by("orden", "id"))
    if contenido["configuracion"].modo_banner == "fijo":
        banners = banners[:1]
    visibles = consultas.votaciones_visibles(edicion)
    abiertas = [v for v in visibles if v.estado == Votacion.Estado.ABIERTA]
    num_categorias = edicion.categorias.filter(activa=True).count()
    dias_festival = max(0, (edicion.fecha_inicio - timezone.localdate()).days)
    total_votos = contenido["total_votos"]
    cuarta = (
        (sum(1 for v in visibles if v.estado == Votacion.Estado.PROGRAMADA), "votaciones programadas")
        if total_votos is None else (total_votos, "votos registrados")
    )
    return render(request, "portal/inicio.html", {
        "edicion": edicion,
        "banners": banners,
        "revista": contenido["revistas"].order_by("orden", "-id").first(),
        "abiertas": abiertas,
        "num_categorias": num_categorias,
        "con_voto": consultas.votaciones_con_voto(request.user),
        "pasos": PASOS_INICIO,
        "cifras": [(dias_festival, "días para el Festival"), (len(abiertas), "votaciones abiertas"),
                   (num_categorias, "categorías"), cuarta],
    })


def ir_a_edicion_activa(request):
    """/categorias lleva a las categorías de la edición activa (/{año})."""
    edicion = selectores.edicion_activa()
    return redirect("portal:edicion", anio=edicion.anio) if edicion else redirect("portal:inicio")


def edicion(request, anio):
    edicion = consultas.edicion_publica(anio)
    if edicion is None:
        return pagina_error(request, 404, "No encontramos una edición activa del Festival con ese año.")
    visibles = consultas.votaciones_visibles(edicion)
    return render(request, "portal/categorias.html", {
        "edicion": edicion,
        "items": consultas.categorias_con_conteo(edicion, visibles),
    })


def categoria(request, anio, categoria):
    edicion = consultas.edicion_publica(anio)
    categoria = Categoria.objects.filter(edicion=edicion, slug=categoria, activa=True).first() if edicion else None
    if categoria is None:
        return pagina_error(request, 404, "La categoría no existe o no está activa.")
    todas = [v for v in consultas.votaciones_visibles(edicion) if v.categoria_id == categoria.pk]
    filtro = request.GET.get("estado", "todas")
    if filtro not in dict(FILTROS_ESTADO):
        filtro = "todas"
    filtros = [
        (valor, etiqueta, len(todas) if valor == "todas" else sum(1 for v in todas if v.estado == valor))
        for valor, etiqueta in FILTROS_ESTADO
    ]
    return render(request, "portal/categoria.html", {
        "edicion": edicion,
        "categoria": categoria,
        "votaciones": todas if filtro == "todas" else [v for v in todas if v.estado == filtro],
        "filtro": filtro,
        "filtros": filtros,
        "con_voto": consultas.votaciones_con_voto(request.user),
    })


def resultados_publicos(votacion, usuario):
    """Resultados con el ganador marcado, o None si aún no son públicos (RN-07)."""
    if not selectores.resultados_visibles_para(votacion, usuario):
        return None
    resultados = reportes.calcular_resultados(votacion)
    maximo = max((f["votos"] for f in resultados["resultados"]), default=0)
    for fila in resultados["resultados"]:
        fila["ganador"] = resultados["total_votos"] > 0 and fila["votos"] == maximo
    return resultados


def votacion_por_ruta(request, edicion, categoria, slug):
    """Votación de la URL; un borrador solo lo ve la administración (vista previa)."""
    if edicion is None:
        return None
    votacion = Votacion.objects.select_related("categoria__edicion").filter(
        categoria__edicion=edicion, categoria__slug=categoria, categoria__activa=True, slug=slug,
    ).first()
    es_admin = request.user.is_authenticated and request.user.es_administrador
    return votacion if votacion and (votacion.publicada or es_admin) else None


def votacion(request, anio, categoria, votacion):
    edicion = consultas.edicion_publica(anio)
    votacion = votacion_por_ruta(request, edicion, categoria, votacion)
    if votacion is None:
        return pagina_error(request, 404, "La votación no existe o aún no ha sido publicada.")
    estado = votacion.estado
    abierta = estado == Votacion.Estado.ABIERTA and not votacion.pausada
    ya_voto = selectores.votos_del_usuario(request.user, votacion) >= votacion.votos_por_usuario_efectivo
    return render(request, "portal/votacion.html", {
        "edicion": edicion,
        "categoria": votacion.categoria,
        "votacion": votacion,
        "estado": estado,
        "abierta": abierta,
        "ya_voto": ya_voto,
        "deshabilitada": not abierta or ya_voto,
        "opciones": votacion.opciones.filter(activa=True).order_by("orden", "id"),
        "resultados": resultados_publicos(votacion, request.user),
        "motivo_resultados": MOTIVO_RESULTADOS.get(votacion.visibilidad_efectiva, MOTIVO_RESULTADOS[Votacion.Visibilidad.AL_CIERRE]),
    })
