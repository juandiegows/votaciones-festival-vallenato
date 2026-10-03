from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from ..comun.permisos import EsAdministrador
from ..votacion import reportes
from ..votacion import selectores as selectores_votacion
from ..votacion.serializers import IntegridadSerializer
from . import selectores
from .serializers import RegistroAuditoriaSerializer


class PaginacionAuditoria(PageNumberPagination):
    page_size = 50


@extend_schema_view(list=extend_schema(summary="Registro de acciones (50 por página)", parameters=[
    OpenApiParameter("accion", OpenApiTypes.STR, description="crear, actualizar, eliminar, publicar, despublicar, cerrar…"),
    OpenApiParameter("entidad", OpenApiTypes.STR, description="edicion, categoria, votacion, opcion, banner…"),
    OpenApiParameter("q", OpenApiTypes.STR, description="Busca en el correo o nombre del usuario y en el ID de la entidad"),
]))
@extend_schema(tags=["Auditoría"])
class AdminAuditoriaViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [EsAdministrador]
    serializer_class = RegistroAuditoriaSerializer
    pagination_class = PaginacionAuditoria

    def get_queryset(self):
        parametros = self.request.query_params
        return selectores.registros(parametros.get("accion"), parametros.get("entidad"), parametros.get("q"))

    @extend_schema(
        summary="Verificación de integridad de los votos de una edición",
        description="Comprueba en cada votación que la suma por opción coincida con el total, que nadie supere el "
                    "límite de votos y que no haya votos por opciones ajenas o inactivas, fuera de plazo o con "
                    "comprobantes repetidos.",
        parameters=[OpenApiParameter("edicion", OpenApiTypes.INT, description="ID de la edición; por defecto, la activa")],
        responses={200: IntegridadSerializer, 404: OpenApiResponse(description="No hay edición")},
    )
    @action(detail=False, pagination_class=None)
    def integridad(self, request):
        edicion_id = request.query_params.get("edicion") or ""
        edicion = selectores_votacion.edicion_o_activa(edicion_id)
        if edicion is None:
            if edicion_id:
                raise NotFound()
            return Response({"detail": "No hay una edición activa."}, status=status.HTTP_404_NOT_FOUND)
        return Response(reportes.verificar_integridad(edicion))
