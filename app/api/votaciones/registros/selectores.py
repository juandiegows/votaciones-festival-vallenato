from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone

from .models import RegistroSistema

NIVELES = ("CRITICAL", "ERROR", "WARNING")


def registros(nivel=None, fuente=None, texto="", dias=None):
    """Registros filtrados; `texto` busca en el mensaje, la excepción, el archivo, la ruta, el id de la petición y el correo."""
    consulta = RegistroSistema.objects.select_related("usuario")
    if nivel:
        consulta = consulta.filter(nivel=nivel)
    if fuente:
        consulta = consulta.filter(fuente=fuente)
    if dias:
        consulta = consulta.filter(fecha_hora__gte=timezone.now() - timedelta(days=int(dias)))
    texto = (texto or "").strip()
    if texto:
        consulta = consulta.filter(
            Q(mensaje__icontains=texto) | Q(excepcion__icontains=texto) | Q(archivo__icontains=texto)
            | Q(ruta__icontains=texto) | Q(id_solicitud=texto) | Q(usuario__email__icontains=texto)
        )
    return consulta


def resumen():
    """Errores de las últimas 24 horas y de los últimos 7 días, y el más reciente."""
    ahora = timezone.now()
    errores = RegistroSistema.objects.filter(nivel__in=("ERROR", "CRITICAL"))
    conteos = errores.aggregate(
        dia=Count("id", filter=Q(fecha_hora__gte=ahora - timedelta(days=1))),
        semana=Count("id", filter=Q(fecha_hora__gte=ahora - timedelta(days=7))),
    )
    ultimo = errores.order_by("-fecha_hora").values_list("fecha_hora", flat=True).first()
    return {"errores_24h": conteos["dia"], "errores_7d": conteos["semana"], "ultimo_error": ultimo}
