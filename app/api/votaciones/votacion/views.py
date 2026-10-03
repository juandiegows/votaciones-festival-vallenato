import csv

from django.http import Http404, HttpResponse
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from .. import correo
from ..auditoria.mixins import AuditadoMixin, auditar
from ..comun.api import ErrorReglaSerializer, ip_cliente
from ..comun.permisos import EsAdministrador
from . import reportes, selectores, servicios
from .models import Edicion
from .serializers import (
    CategoriaSerializer,
    EdicionSerializer,
    OpcionListadoPublicoSerializer,
    OpcionSerializer,
    ParticipacionSerializer,
    PublicarResultadosSerializer,
    ResultadosSerializer,
    ResumenEdicionSerializer,
    VotacionDetalleSerializer,
    VotacionPublicaSerializer,
    VotacionSerializer,
    VotarSerializer,
    VotoAdminSerializer,
    VotoSerializer,
)

# Una celda que empieza por estos caracteres se ejecuta como fórmula al abrir el CSV en Excel o LibreOffice
INICIO_FORMULA = ("=", "+", "-", "@", "\t", "\r")


def celda_csv(valor):
    texto = str(valor)
    return f"'{texto}" if texto.startswith(INICIO_FORMULA) else texto


def valor_publicar(request):
    """Lee {"publicar": bool} validado: con bool() el texto "false" contaría como verdadero."""
    serializer = PublicarResultadosSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data["publicar"]


# Consulta pública y votación


@extend_schema_view(list=extend_schema(summary="Listar ediciones"), retrieve=extend_schema(summary="Detalle de edición"))
@extend_schema(tags=["Consulta pública"])
class EdicionPublicaViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    serializer_class = EdicionSerializer
    queryset = Edicion.objects.all()

    @action(detail=False)
    def vigente(self, request):
        edicion = selectores.edicion_activa()
        if not edicion:
            return Response({"detail": "No hay una edición activa."}, status=status.HTTP_404_NOT_FOUND)
        return Response(EdicionSerializer(edicion).data)


@extend_schema_view(
    list=extend_schema(summary="Categorías activas (RF-04)", parameters=[
        OpenApiParameter("edicion", OpenApiTypes.INT, description="ID de la edición; por defecto, la edición activa"),
        OpenApiParameter("anio", OpenApiTypes.INT, description="Año de la edición (URL amigable /{año})")]),
    retrieve=extend_schema(summary="Detalle de categoría"),
)
@extend_schema(tags=["Consulta pública"])
class CategoriaPublicaViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    serializer_class = CategoriaSerializer

    def get_queryset(self):
        parametros = self.request.query_params
        return selectores.categorias_publicas(parametros.get("edicion"), parametros.get("anio"))


@extend_schema_view(
    list=extend_schema(summary="Votaciones publicadas (RF-05)", parameters=[
        OpenApiParameter("categoria", OpenApiTypes.INT, description="ID de la categoría"),
        OpenApiParameter("estado", OpenApiTypes.STR, enum=["programada", "abierta", "cerrada"]),
        OpenApiParameter("anio", OpenApiTypes.INT, description="Año de la edición"),
        OpenApiParameter("categoria_slug", OpenApiTypes.STR, description="Slug de la categoría"),
        OpenApiParameter("slug", OpenApiTypes.STR, description="Slug de la votación")]),
    retrieve=extend_schema(summary="Detalle con opciones y votos del usuario (RF-06)"),
)
@extend_schema(tags=["Consulta pública"])
class VotacionPublicaViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    throttle_scope = None  # la acción «votar» lo define; DRF solo acepta en @action atributos que existan en la clase

    def get_queryset(self):
        parametros = self.request.query_params
        return selectores.votaciones_publicas(
            parametros.get("categoria"), parametros.get("anio"), parametros.get("categoria_slug"), parametros.get("slug")
        )

    def get_serializer_class(self):
        if self.action in ("retrieve", "por_ruta"):
            return VotacionDetalleSerializer
        return VotacionPublicaSerializer

    @extend_schema(
        summary="Detalle por URL amigable /{año}/{categoría}/{votación} (RF-06)",
        parameters=[
            OpenApiParameter("anio", OpenApiTypes.INT, required=True, description="Año de la edición"),
            OpenApiParameter("categoria", OpenApiTypes.STR, required=True, description="Slug de la categoría"),
            OpenApiParameter("votacion", OpenApiTypes.STR, required=True, description="Slug de la votación"),
        ],
        responses={200: VotacionDetalleSerializer, 404: OpenApiResponse(description="No existe o no está publicada")},
    )
    @action(detail=False, url_path="por-ruta")
    def por_ruta(self, request):
        parametros = request.query_params
        votacion = selectores.votacion_publica_por_ruta(
            parametros.get("anio"), parametros.get("categoria"), parametros.get("votacion")
        )
        if votacion is None:
            raise Http404
        return Response(self.get_serializer(votacion).data)

    def list(self, request, *args, **kwargs):
        votaciones = selectores.filtrar_por_estado(self.get_queryset(), request.query_params.get("estado"))
        return Response(self.get_serializer(votaciones, many=True).data)

    @extend_schema(tags=["Votación"], summary="Emitir voto (RF-07, RF-08; RN-02 a RN-05)", request=VotarSerializer,
                   responses={201: VotoSerializer, 400: ErrorReglaSerializer, 409: ErrorReglaSerializer})
    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated],
            throttle_classes=[ScopedRateThrottle], throttle_scope="votar")
    def votar(self, request, pk=None):
        votacion = self.get_object()
        serializer = VotarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        voto = servicios.emitir_voto(request.user, votacion.pk, serializer.validated_data["opcion"], ip_cliente(request))
        correo.enviar_al_confirmar(correo.enviar_comprobante_voto, voto)
        return Response(VotoSerializer(voto).data, status=status.HTTP_201_CREATED)

    @extend_schema(summary="Resultados públicos según visibilidad (RF-15, RN-07)",
                   responses={200: ResultadosSerializer, 403: OpenApiResponse(description="Aún no son públicos")})
    @action(detail=True)
    def resultados(self, request, pk=None):
        votacion = self.get_object()
        if not selectores.resultados_visibles_para(votacion, request.user):
            raise PermissionDenied("Los resultados de esta votación aún no son públicos.")
        return Response(reportes.calcular_resultados(votacion))


@extend_schema_view(
    list=extend_schema(summary="Opciones activas de las votaciones publicadas (RF-06)", parameters=[
        OpenApiParameter("votacion", OpenApiTypes.INT, description="ID de la votación")]),
    retrieve=extend_schema(summary="Detalle de opción"),
)
@extend_schema(tags=["Consulta pública"])
class OpcionPublicaViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    serializer_class = OpcionListadoPublicoSerializer

    def get_queryset(self):
        return selectores.opciones_publicas(self.request.query_params.get("votacion"))


@extend_schema(tags=["Votación"], summary="Mis votos y comprobantes (RF-09)")
class MisVotosView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = VotoSerializer

    def get_queryset(self):
        return selectores.votos_de(self.request.user)


# Administración


@extend_schema(tags=["Administración"])
class AdminEdicionViewSet(AuditadoMixin, viewsets.ModelViewSet):
    """Solo puede haber una edición activa: al activar una, las demás pasan a cerradas."""

    permission_classes = [EsAdministrador]
    serializer_class = EdicionSerializer
    queryset = Edicion.objects.all()
    entidad = "edicion"

    def perform_create(self, serializer):
        super().perform_create(serializer)
        servicios.cerrar_otras_ediciones(serializer.instance)

    def perform_update(self, serializer):
        super().perform_update(serializer)
        servicios.cerrar_otras_ediciones(serializer.instance)

    @extend_schema(summary="Publicar u ocultar los resultados de todas las votaciones de la edición (RF-15)",
                   request=PublicarResultadosSerializer, responses={200: OpenApiResponse(description="Número de votaciones actualizadas")})
    @action(detail=True, methods=["post"], url_path="publicar-resultados")
    def publicar_resultados(self, request, pk=None):
        edicion = self.get_object()
        publicar = valor_publicar(request)
        actualizadas = servicios.publicar_resultados_edicion(edicion, publicar)
        auditar(request, "publicar_resultados", self.entidad, edicion.pk, {"publicar": publicar, "votaciones": actualizadas})
        return Response({"publicar": publicar, "actualizadas": actualizadas})

    @extend_schema(summary="Resumen de votos por categoría, votación y opción", responses={200: ResumenEdicionSerializer})
    @action(detail=True)
    def resumen(self, request, pk=None):
        return Response(reportes.resumen_edicion(self.get_object()))


@extend_schema_view(list=extend_schema(parameters=[OpenApiParameter("edicion", OpenApiTypes.INT)]))
@extend_schema(tags=["Administración"])
class AdminCategoriaViewSet(AuditadoMixin, viewsets.ModelViewSet):
    permission_classes = [EsAdministrador]
    serializer_class = CategoriaSerializer
    entidad = "categoria"
    campos_archivo = ("icono_imagen",)

    def get_queryset(self):
        return selectores.categorias(self.request.query_params.get("edicion"))


@extend_schema_view(
    list=extend_schema(parameters=[OpenApiParameter("categoria", OpenApiTypes.INT)]),
    destroy=extend_schema(responses={204: None, 409: ErrorReglaSerializer}, summary="Eliminar (solo sin votos, RN-09)"),
)
@extend_schema(tags=["Administración"])
class AdminVotacionViewSet(AuditadoMixin, viewsets.ModelViewSet):
    permission_classes = [EsAdministrador]
    serializer_class = VotacionSerializer
    entidad = "votacion"
    campos_archivo = ("icono_imagen",)

    def get_queryset(self):
        return selectores.votaciones(self.request.query_params.get("categoria"))

    def validar_eliminacion(self, votacion):
        servicios.validar_eliminacion(votacion)

    @extend_schema(summary="Publicar votación (RN-06)", request=None,
                   responses={200: VotacionSerializer, 400: ErrorReglaSerializer})
    @action(detail=True, methods=["post"])
    def publicar(self, request, pk=None):
        votacion = servicios.publicar_votacion(self.get_object())
        auditar(request, "publicar", self.entidad, votacion.pk)
        return Response(VotacionSerializer(votacion).data)

    @extend_schema(summary="Despublicar votación (no se permite mientras está abierta)", request=None,
                   responses={200: VotacionSerializer, 409: ErrorReglaSerializer})
    @action(detail=True, methods=["post"])
    def despublicar(self, request, pk=None):
        votacion = servicios.despublicar_votacion(self.get_object())
        auditar(request, "despublicar", self.entidad, votacion.pk, {"titulo": votacion.titulo})
        return Response(VotacionSerializer(votacion).data)

    @extend_schema(
        summary="Quién votó, sin revelar por qué opción",
        description="Antes del cierre la lista se revela en bloques de 10 votantes y siempre en orden alfabético, "
                    "con la fecha sin hora, para que no se pueda deducir el voto de nadie.",
        responses={200: ParticipacionSerializer},
    )
    @action(detail=True)
    def participacion(self, request, pk=None):
        return Response(reportes.participacion(self.get_object()))

    @extend_schema(summary="Cerrar votación anticipadamente", request=None, responses={200: VotacionSerializer})
    @action(detail=True, methods=["post"])
    def cerrar(self, request, pk=None):
        votacion = servicios.cerrar_votacion(self.get_object())
        auditar(request, "cerrar", self.entidad, votacion.pk)
        return Response(VotacionSerializer(votacion).data)

    @extend_schema(summary="Publicar u ocultar resultados (RF-15)", request=PublicarResultadosSerializer,
                   responses={200: VotacionSerializer})
    @action(detail=True, methods=["post"], url_path="publicar-resultados")
    def publicar_resultados(self, request, pk=None):
        votacion = servicios.publicar_resultados_votacion(self.get_object(), valor_publicar(request))
        auditar(request, "publicar_resultados", self.entidad, votacion.pk, {"publicar": votacion.resultados_publicados})
        return Response(VotacionSerializer(votacion).data)

    @extend_schema(summary="Resultados completos (RF-14)", responses={200: ResultadosSerializer})
    @action(detail=True)
    def resultados(self, request, pk=None):
        return Response(reportes.calcular_resultados(self.get_object()))

    @extend_schema(summary="Exportar resultados en CSV (RF-14)",
                   responses={(200, "text/csv"): OpenApiResponse(response=OpenApiTypes.BINARY, description="Archivo CSV")})
    @action(detail=True, url_path="resultados/csv")
    def resultados_csv(self, request, pk=None):
        votacion = self.get_object()
        datos = reportes.calcular_resultados(votacion)
        respuesta = HttpResponse(content_type="text/csv; charset=utf-8")
        nombre = f"resultados-votacion-{votacion.pk}-{timezone.localdate():%Y%m%d}.csv"
        respuesta["Content-Disposition"] = f'attachment; filename="{nombre}"'
        respuesta.write("﻿")
        escritor = csv.writer(respuesta)
        escritor.writerow(["Opción", "Votos", "Porcentaje"])
        for fila in datos["resultados"]:
            escritor.writerow([celda_csv(fila["opcion"]), fila["votos"], fila["porcentaje"]])
        escritor.writerow(["Total", datos["total_votos"], 100 if datos["total_votos"] else 0])
        auditar(request, "exportar_resultados", self.entidad, votacion.pk)
        return respuesta


@extend_schema_view(
    list=extend_schema(parameters=[OpenApiParameter("votacion", OpenApiTypes.INT)]),
    destroy=extend_schema(responses={204: None, 409: ErrorReglaSerializer}, summary="Eliminar (solo sin votos, RN-09)"),
)
@extend_schema(tags=["Administración"])
class AdminOpcionViewSet(AuditadoMixin, viewsets.ModelViewSet):
    permission_classes = [EsAdministrador]
    serializer_class = OpcionSerializer
    entidad = "opcion"
    campos_archivo = ("audio",)

    def get_queryset(self):
        return selectores.opciones(self.request.query_params.get("votacion"))

    def validar_eliminacion(self, opcion):
        servicios.validar_eliminacion(opcion)


@extend_schema_view(
    list=extend_schema(summary="Votos registrados para indicadores (sin datos del votante)", parameters=[
        OpenApiParameter("votacion", OpenApiTypes.INT, description="ID de la votación")]),
    retrieve=extend_schema(summary="Detalle de voto (sin datos del votante)"),
)
@extend_schema(tags=["Administración"])
class AdminVotoViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [EsAdministrador]
    serializer_class = VotoAdminSerializer

    def get_queryset(self):
        return selectores.votos(self.request.query_params.get("votacion"))
