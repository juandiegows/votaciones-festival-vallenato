import logging

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from ..comun.permisos import TienePermiso
from . import selectores
from .models import RegistroSistema
from .serializers import ErrorClienteSerializer, RegistroSistemaSerializer

logger_web = logging.getLogger("web.cliente")


class ErrorDePrueba(RuntimeError):
    """Error provocado a propósito desde el panel para comprobar que los registros funcionan."""


def provocar_error_de_prueba(usuario):
    raise ErrorDePrueba(f"Error de prueba provocado por {usuario.email} para verificar los registros del sistema.")


class PaginacionRegistros(PageNumberPagination):
    page_size = 50


@extend_schema_view(list=extend_schema(summary="Errores del servidor y de la web (50 por página)", parameters=[
    OpenApiParameter("nivel", OpenApiTypes.STR, enum=list(selectores.NIVELES)),
    OpenApiParameter("fuente", OpenApiTypes.STR, enum=[f.value for f in RegistroSistema.Fuente]),
    OpenApiParameter("dias", OpenApiTypes.INT, description="Solo los de los últimos N días"),
    OpenApiParameter("q", OpenApiTypes.STR, description="Mensaje, excepción, archivo, ruta, id de la petición o correo"),
]), retrieve=extend_schema(summary="Detalle de un registro con su traza"))
@extend_schema(tags=["Registros del sistema"])
class AdminRegistrosViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [TienePermiso]
    permisos_accion = {"list": "registros.ver", "retrieve": "registros.ver", "resumen": "registros.ver",
                       "probar": "registros.ver"}
    serializer_class = RegistroSistemaSerializer
    pagination_class = PaginacionRegistros

    def get_queryset(self):
        p = self.request.query_params
        dias = p.get("dias", "")
        return selectores.registros(p.get("nivel"), p.get("fuente"), p.get("q"), dias if dias.isdigit() else None)

    @extend_schema(summary="Errores de las últimas 24 horas y 7 días", responses={200: OpenApiTypes.OBJECT})
    @action(detail=False, pagination_class=None)
    def resumen(self, request):
        return Response(selectores.resumen())

    @extend_schema(
        summary="Provocar un error de prueba",
        description="Lanza una excepción sin atrapar: responde 500 con la `referencia` (X-Request-ID) y el error "
                    "queda en el registro con su traza, archivo y línea.",
        request=None, responses={500: OpenApiResponse(description="Error de prueba registrado")},
    )
    @action(detail=False, methods=["post"])
    def probar(self, request):
        provocar_error_de_prueba(request.user)


@extend_schema(
    tags=["Registros del sistema"], summary="Reportar un error de JavaScript de la web",
    description="Lo usa la web React (window.onerror, promesas rechazadas y el ErrorBoundary). Sin sesión; "
                "limitado por IP.",
    request=ErrorClienteSerializer, responses={204: None},
)
class ErrorClienteView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "errores_web"

    def post(self, request):
        datos = ErrorClienteSerializer(data=request.data)
        datos.is_valid(raise_exception=True)
        d = datos.validated_data
        tipo = d.get("tipo") or "Error"
        traza = d.get("traza", "")
        if d.get("componentes"):
            traza = f"{traza}\n\nComponentes de React:{d['componentes']}".strip()
        logger_web.error(
            "%s: %s", tipo, d["mensaje"],
            extra={
                "fuente": RegistroSistema.Fuente.WEB,
                "ubicacion": {
                    "excepcion": f"{tipo}: {d['mensaje']}"[:255], "traza": traza,
                    "archivo": (d.get("archivo") or "")[:255], "linea": d.get("linea"),
                    "funcion": f"columna {d['columna']}" if d.get("columna") is not None else "",
                },
                "detalle": {"url": d.get("url", ""), "version": d.get("version", "")},
            },
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
