"""Lecturas del dominio: consultas que usan las vistas y los reportes. No modifican datos."""

from ..comun.consultas import filtrar_por_id
from .models import Categoria, Edicion, Opcion, Votacion, Voto


def edicion_activa():
    return Edicion.objects.filter(estado=Edicion.Estado.ACTIVA).order_by("-anio").first()


def edicion_o_activa(edicion_id=""):
    """La edición pedida por ID o, si no se indica, la activa. None si no existe."""
    if edicion_id:
        return Edicion.objects.filter(pk=int(edicion_id)).first() if str(edicion_id).isdigit() else None
    return edicion_activa()


def categorias_publicas(edicion_id=None, anio=None):
    """Categorías activas de una edición (por ID o año); por defecto, de la edición activa."""
    consulta = Categoria.objects.filter(activa=True).select_related("edicion")
    if edicion_id:
        return filtrar_por_id(consulta, "edicion_id", edicion_id)
    if anio:
        return filtrar_por_id(consulta, "edicion__anio", anio)
    return consulta.filter(edicion__estado=Edicion.Estado.ACTIVA)


def categorias(edicion_id=None):
    return filtrar_por_id(Categoria.objects.select_related("edicion"), "edicion_id", edicion_id)


def votaciones_publicadas():
    return Votacion.objects.filter(publicada=True, categoria__activa=True).select_related("categoria__edicion")


def votaciones_publicas(categoria_id=None, anio=None, categoria_slug=None, slug=None):
    consulta = filtrar_por_id(votaciones_publicadas(), "categoria_id", categoria_id)
    consulta = filtrar_por_id(consulta, "categoria__edicion__anio", anio)
    textos = {"categoria__slug": categoria_slug, "slug": slug}
    return consulta.filter(**{campo: valor for campo, valor in textos.items() if valor})


def votacion_publica_por_ruta(anio, categoria_slug, slug):
    """Votación publicada por su URL amigable /{año}/{categoría}/{votación}; None si no existe."""
    anio = str(anio or "")
    return votaciones_publicadas().filter(
        categoria__edicion__anio=int(anio) if anio.isdigit() else -1,
        categoria__slug=categoria_slug or "",
        slug=slug or "",
    ).first()


def filtrar_por_estado(votaciones, estado):
    """El estado se calcula con la hora actual (no es una columna), así que se filtra en Python."""
    return [v for v in votaciones if v.estado == estado] if estado else list(votaciones)


def votaciones(categoria_id=None):
    return filtrar_por_id(Votacion.objects.select_related("categoria__edicion"), "categoria_id", categoria_id)


def opciones_publicas(votacion_id=None):
    consulta = Opcion.objects.filter(activa=True, votacion__publicada=True, votacion__categoria__activa=True)
    return filtrar_por_id(consulta, "votacion_id", votacion_id)


def opciones(votacion_id=None):
    return filtrar_por_id(Opcion.objects.all(), "votacion_id", votacion_id)


def votos(votacion_id=None):
    return filtrar_por_id(Voto.objects.all(), "votacion_id", votacion_id)


def votos_de(usuario):
    return Voto.objects.filter(usuario=usuario).select_related("votacion__categoria__edicion", "opcion")


def votos_del_usuario(usuario, votacion):
    if not usuario.is_authenticated:
        return 0
    return Voto.objects.filter(usuario=usuario, votacion=votacion).count()


def total_votos_edicion(edicion):
    return Voto.objects.filter(votacion__categoria__edicion=edicion).count()


def resultados_visibles_para(votacion, usuario):
    """Regla pública (RN-07): igual para todos, también para un administrador que navega el sitio.
    La administración consulta los resultados completos en /api/gestion/votaciones/{id}/resultados/."""
    if not votacion.publicada:
        return False
    if votacion.resultados_publicados:
        return True
    visibilidad = votacion.visibilidad_efectiva
    if visibilidad == Votacion.Visibilidad.TIEMPO_REAL:
        return True
    if visibilidad == Votacion.Visibilidad.AL_CIERRE:
        return votacion.estado == Votacion.Estado.CERRADA
    return False
