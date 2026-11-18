"""
Interceptor de registros (middleware): envuelve cada petición del sitio MVT y de la API.

1. Le asigna un id corto (o reutiliza el X-Request-ID válido que mande el proxy) y lo devuelve en el encabezado
   X-Request-ID. Ese id va en cada línea de log, en el registro del error y en la pantalla de error 500
   («Referencia»): con él se encuentra en /panel/registros exactamente lo que le pasó a quien reporta el fallo.
2. Escribe la línea de acceso (método, ruta, estado y duración) en la consola.
3. Intercepta toda excepción no controlada de una vista (también las de DRF que no son APIException): la registra
   con su traza, el archivo y la línea de nuestro código donde ocurrió, el usuario y la IP, y responde 500 con la
   referencia: JSON en /api/… y la página de error con la marca en el sitio. Con DEBUG deja la página técnica de
   Django (pero igual queda registrada).
"""

import logging
import re
import time
import uuid
from contextvars import ContextVar

from django.conf import settings
from django.core.exceptions import BadRequest, PermissionDenied, SuspiciousOperation
from django.http import Http404
from django.http.multipartparser import MultiPartParserError
from django.http import JsonResponse

_peticion = ContextVar("peticion_registro", default=None)
logger_acceso = logging.getLogger("votaciones.acceso")
logger_errores = logging.getLogger("votaciones.errores")

ID_VALIDO = re.compile(r"^[A-Za-z0-9-]{8,32}$")
# Sin línea de acceso: archivos estáticos, subidos y la sonda de salud de Docker
SIN_ACCESO = ("/static/", "/media/", "/api/salud/", "/favicon")
# Las que Django ya convierte en 400/403/404: no son fallos del código
ESPERADAS = (Http404, PermissionDenied, BadRequest, SuspiciousOperation, MultiPartParserError)
MENSAJE_500 = "Ocurrió un error inesperado. Ya quedó registrado; si te comunicas con soporte, indica la referencia."


def peticion_actual():
    """HttpRequest en curso (None fuera de una petición: comandos, hilos de correo, migraciones)."""
    return _peticion.get()


def id_peticion_actual():
    return getattr(peticion_actual(), "id_solicitud", "")


def respuesta_error_500(request):
    """Respuesta 500 con la referencia de la petición: JSON para la API, página con la marca para el sitio."""
    referencia = getattr(request, "id_solicitud", "")
    if request.path.startswith("/api/"):
        return JsonResponse({"detail": MENSAJE_500, "codigo": "error_interno", "referencia": referencia}, status=500)
    from portal.vistas.errores import pagina_error

    return pagina_error(request, 500, MENSAJE_500)


class InterceptorRegistros:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        recibido = request.META.get("HTTP_X_REQUEST_ID", "")
        request.id_solicitud = recibido if ID_VALIDO.match(recibido) else uuid.uuid4().hex[:12]
        token = _peticion.set(request)
        inicio = time.monotonic()
        try:
            respuesta = self.get_response(request)
            respuesta["X-Request-ID"] = request.id_solicitud
            if not request.path.startswith(SIN_ACCESO):
                duracion = round((time.monotonic() - inicio) * 1000)
                nivel = logging.ERROR if respuesta.status_code >= 500 else logging.INFO
                # La excepción ya quedó registrada con su traza: esta es solo la línea de acceso (consola/archivos)
                logger_acceso.log(
                    nivel, "%s %s %s %sms", request.method, request.get_full_path()[:300], respuesta.status_code,
                    duracion, extra={"estado_http": respuesta.status_code, "duracion_ms": duracion, "solo_consola": True},
                )
            return respuesta
        finally:
            _peticion.reset(token)

    def process_exception(self, request, excepcion):
        if isinstance(excepcion, ESPERADAS):
            return None
        request.error_registrado = True  # para no guardarlo dos veces si Django también lo escribe en django.request
        logger_errores.error(
            "Error no controlado en %s %s: %s", request.method, request.path, excepcion,
            exc_info=(type(excepcion), excepcion, excepcion.__traceback__),
            extra={"request": request, "estado_http": 500},
        )
        if settings.DEBUG:
            return None  # página técnica de Django (Django vuelve a escribirla en django.request, solo en consola)
        return respuesta_error_500(request)
