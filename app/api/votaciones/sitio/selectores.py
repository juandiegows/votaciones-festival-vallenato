from ..comun.consultas import filtrar_por_id
from ..votacion import selectores as selectores_votacion
from .models import BannerInicio, ConfiguracionSitio, RedSocial, Revista


def contenido_publico():
    """Contacto, redes, revistas y banners activos de la edición activa (la más reciente si hubiera varias)."""
    configuracion = ConfiguracionSitio.obtener()
    activa = selectores_votacion.edicion_activa()
    mostrar_total = configuracion.mostrar_total_votos and activa
    return {
        "total_votos": selectores_votacion.total_votos_edicion(activa) if mostrar_total else None,
        "configuracion": configuracion,
        "redes": RedSocial.objects.filter(activa=True),
        "banners": BannerInicio.objects.filter(activo=True, edicion=activa),
        "revistas": Revista.objects.filter(activa=True),
    }


def banners(edicion_id=None):
    return filtrar_por_id(BannerInicio.objects.select_related("edicion"), "edicion_id", edicion_id)
