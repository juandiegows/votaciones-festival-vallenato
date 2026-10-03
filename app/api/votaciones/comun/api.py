"""Piezas de la capa HTTP compartidas por todos los módulos: errores de negocio e IP del cliente."""

import ipaddress

from django.conf import settings
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.views import exception_handler

from .errores import ReglaNegocioError


def manejar_excepciones(exc, context):
    """EXCEPTION_HANDLER de DRF: una ReglaNegocioError llega al cliente como {"detail", "codigo"}."""
    if isinstance(exc, ReglaNegocioError):
        return Response({"detail": exc.mensaje, "codigo": exc.codigo}, status=exc.status)
    return exception_handler(exc, context)


def ip_cliente(request):
    """
    IP real del cliente. Solo se confía en X-Forwarded-For cuando hay proxies declarados (NUM_PROXIES) y se toma
    la entrada que agregó el proxy más externo, no la primera (esa la puede escribir el propio cliente).
    Devuelve None si el valor no es una IP válida.
    """
    ip = request.META.get("REMOTE_ADDR")
    reenviada = request.META.get("HTTP_X_FORWARDED_FOR")
    if settings.NUM_PROXIES and reenviada:
        saltos = [parte.strip() for parte in reenviada.split(",")]
        ip = saltos[-min(settings.NUM_PROXIES, len(saltos))]
    try:
        return str(ipaddress.ip_address(ip))
    except ValueError:
        return None


class ErrorReglaSerializer(serializers.Serializer):
    detail = serializers.CharField(help_text="Mensaje legible; cita la regla de negocio (RN-xx).")
    codigo = serializers.CharField(
        help_text="votacion_no_abierta · opcion_invalida · limite_votos · opciones_insuficientes · tiene_votos · registros_asociados · votaciones_pausadas"
    )
