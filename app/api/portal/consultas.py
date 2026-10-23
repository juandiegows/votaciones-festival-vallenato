"""Consultas del sitio público con el ORM de Django (reglas de visibilidad RN-13 y RN-14)."""

from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone

from votaciones.models import Edicion, Votacion, Voto
from votaciones.sitio.models import ConfiguracionSitio
from votaciones.votacion import selectores


def edicion_publica(anio):
    """Edición por año, solo si está activa: las ediciones cerradas no se muestran al público (RN-14)."""
    return Edicion.objects.filter(anio=anio, estado=Edicion.Estado.ACTIVA).first()


def votaciones_visibles(edicion):
    """
    Votaciones que ve el público en la edición: publicadas y de categorías activas. Una votación cerrada sigue
    visible los días configurados después de su cierre (RN-13); sin valor, siempre.
    """
    if edicion is None or edicion.estado != Edicion.Estado.ACTIVA:
        return []
    dias = ConfiguracionSitio.obtener().dias_visible_cerradas
    ahora = timezone.now()
    consulta = (
        selectores.votaciones_publicadas()
        .filter(categoria__edicion=edicion)
        .annotate(num_opciones=Count("opciones", filter=Q(opciones__activa=True)))
    )
    return [
        v for v in consulta
        if v.estado_en(ahora) != Votacion.Estado.CERRADA or dias is None or v.fecha_cierre + timedelta(days=dias) > ahora
    ]


def votaciones_con_voto(usuario):
    """IDs de las votaciones en las que el usuario ya votó (para la insignia «Ya votaste»)."""
    if not usuario.is_authenticated:
        return set()
    return set(Voto.objects.filter(usuario=usuario).values_list("votacion_id", flat=True))


def opciones_votadas(usuario, votacion):
    """IDs de las opciones que el usuario eligió en esta votación (se marcan en el detalle)."""
    if not usuario.is_authenticated:
        return set()
    return set(Voto.objects.filter(usuario=usuario, votacion=votacion).values_list("opcion_id", flat=True))


def categorias_con_conteo(edicion, visibles):
    """Categorías activas de la edición con su total de votaciones visibles y cuántas están abiertas."""
    filas = []
    for categoria in edicion.categorias.filter(activa=True).order_by("orden", "nombre"):
        propias = [v for v in visibles if v.categoria_id == categoria.pk]
        filas.append({
            "categoria": categoria,
            "total": len(propias),
            "abiertas": sum(1 for v in propias if v.estado == Votacion.Estado.ABIERTA),
        })
    return filas
