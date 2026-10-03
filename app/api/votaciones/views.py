import csv

from django.db.models import ProtectedError
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import generics, mixins, status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from . import servicios
from .models import Categoria, Edicion, Opcion, RegistroAuditoria, Usuario, Votacion, Voto
from .permissions import EsAdministrador
from .serializers import (
    CategoriaSerializer,
    EdicionSerializer,
    ErrorReglaSerializer,
    LoginSerializer,
    OpcionListadoPublicoSerializer,
    OpcionSerializer,
    PublicarResultadosSerializer,
    RegistroAuditoriaSerializer,
    RegistroSerializer,
    ResultadosSerializer,
    TokenRespuestaSerializer,
    UsuarioAdminSerializer,
    UsuarioSerializer,
    VotacionDetalleSerializer,
    VotacionPublicaSerializer,
    VotacionSerializer,
    VotarSerializer,
    VotoAdminSerializer,
    VotoSerializer,
)


def respuesta_regla(error):
    return Response({"detail": error.mensaje, "codigo": error.codigo}, status=error.status)


def respuesta_auth(usuario, codigo_http=status.HTTP_200_OK):
    token, _ = Token.objects.get_or_create(user=usuario)
    return Response({"token": token.key, "usuario": UsuarioSerializer(usuario).data}, status=codigo_http)


@extend_schema(tags=["Autenticación"], summary="Registrar votante (RF-01, RN-10)", request=RegistroSerializer,
               responses={201: TokenRespuestaSerializer, 400: OpenApiResponse(description="Datos inválidos")})
class RegistroView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "registro"

    def post(self, request):
        serializer = RegistroSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        usuario = serializer.save()
        return respuesta_auth(usuario, status.HTTP_201_CREATED)


@extend_schema(tags=["Autenticación"], summary="Iniciar sesión (RF-02)", request=LoginSerializer,
               responses={200: TokenRespuestaSerializer, 400: OpenApiResponse(description="Credenciales incorrectas")})
class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        return respuesta_auth(serializer.validated_data["usuario"])


@extend_schema(tags=["Autenticación"], summary="Cerrar sesión (invalida el token)", request=None, responses={204: None})
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["Autenticación"], summary="Usuario autenticado")
class PerfilView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UsuarioSerializer

    def get_object(self):
        return self.request.user


@extend_schema_view(list=extend_schema(summary="Listar ediciones"), retrieve=extend_schema(summary="Detalle de edición"))
@extend_schema(tags=["Consulta pública"])
class EdicionPublicaViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    serializer_class = EdicionSerializer
    queryset = Edicion.objects.all()

    @action(detail=False)
    def vigente(self, request):
        edicion = Edicion.objects.filter(estado=Edicion.Estado.ACTIVA).order_by("-anio").first()
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
        consulta = Categoria.objects.filter(activa=True).select_related("edicion")
        edicion = self.request.query_params.get("edicion")
        anio = self.request.query_params.get("anio")
        if edicion:
            return consulta.filter(edicion_id=edicion)
        if anio:
            return consulta.filter(edicion__anio=anio)
        return consulta.filter(edicion__estado=Edicion.Estado.ACTIVA)


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
    throttle_scope = None

    def get_queryset(self):
        consulta = Votacion.objects.filter(publicada=True, categoria__activa=True).select_related(
            "categoria__edicion"
        )
        filtros = {
            "categoria_id": self.request.query_params.get("categoria"),
            "categoria__edicion__anio": self.request.query_params.get("anio"),
            "categoria__slug": self.request.query_params.get("categoria_slug"),
            "slug": self.request.query_params.get("slug"),
        }
        return consulta.filter(**{campo: valor for campo, valor in filtros.items() if valor})

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
        anio = request.query_params.get("anio", "")
        votacion = get_object_or_404(
            Votacion.objects.filter(publicada=True, categoria__activa=True).select_related("categoria__edicion"),
            categoria__edicion__anio=int(anio) if anio.isdigit() else -1,
            categoria__slug=request.query_params.get("categoria", ""),
            slug=request.query_params.get("votacion", ""),
        )
        return Response(self.get_serializer(votacion).data)

    def list(self, request, *args, **kwargs):
        votaciones = list(self.get_queryset())
        estado = request.query_params.get("estado")
        if estado:
            votaciones = [v for v in votaciones if v.estado == estado]
        return Response(self.get_serializer(votaciones, many=True).data)

    @extend_schema(tags=["Votación"], summary="Emitir voto (RF-07, RF-08; RN-02 a RN-05)", request=VotarSerializer,
                   responses={201: VotoSerializer, 400: ErrorReglaSerializer, 409: ErrorReglaSerializer})
    @action(detail=True, methods=["post"], permission_classes=[IsAuthenticated],
            throttle_classes=[ScopedRateThrottle], throttle_scope="votar")
    def votar(self, request, pk=None):
        votacion = self.get_object()
        serializer = VotarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            voto = servicios.emitir_voto(
                request.user, votacion.pk, serializer.validated_data["opcion"], servicios.ip_cliente(request)
            )
        except servicios.ReglaNegocioError as error:
            return respuesta_regla(error)
        return Response(VotoSerializer(voto).data, status=status.HTTP_201_CREATED)

    @extend_schema(summary="Resultados públicos según visibilidad (RF-15, RN-07)",
                   responses={200: ResultadosSerializer, 403: OpenApiResponse(description="Aún no son públicos")})
    @action(detail=True)
    def resultados(self, request, pk=None):
        votacion = self.get_object()
        if not servicios.resultados_visibles_para(votacion, request.user):
            raise PermissionDenied("Los resultados de esta votación aún no son públicos.")
        return Response(servicios.calcular_resultados(votacion))


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
        consulta = Opcion.objects.filter(activa=True, votacion__publicada=True, votacion__categoria__activa=True)
        votacion = self.request.query_params.get("votacion")
        return consulta.filter(votacion_id=votacion) if votacion else consulta


@extend_schema(tags=["Votación"], summary="Mis votos y comprobantes (RF-09)")
class MisVotosView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = VotoSerializer

    def get_queryset(self):
        return Voto.objects.filter(usuario=self.request.user).select_related("votacion__categoria__edicion", "opcion")


class AuditadoMixin:
    entidad = ""

    def perform_create(self, serializer):
        objeto = serializer.save()
        servicios.auditar(self.request, "crear", self.entidad, objeto.pk, serializer.data)

    def perform_update(self, serializer):
        objeto = serializer.save()
        servicios.auditar(self.request, "actualizar", self.entidad, objeto.pk, serializer.data)

    def destroy(self, request, *args, **kwargs):
        objeto = self.get_object()
        try:
            self.validar_eliminacion(objeto)
            pk = objeto.pk
            objeto.delete()
        except servicios.ReglaNegocioError as error:
            return respuesta_regla(error)
        except ProtectedError:
            return Response(
                {"detail": "No se puede eliminar porque tiene registros asociados; desactívalo.",
                 "codigo": "registros_asociados"},
                status=status.HTTP_409_CONFLICT,
            )
        servicios.auditar(request, "eliminar", self.entidad, pk)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def validar_eliminacion(self, objeto):
        pass


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


@extend_schema_view(list=extend_schema(parameters=[OpenApiParameter("edicion", OpenApiTypes.INT)]))
@extend_schema(tags=["Administración"])
class AdminCategoriaViewSet(AuditadoMixin, viewsets.ModelViewSet):
    permission_classes = [EsAdministrador]
    serializer_class = CategoriaSerializer
    entidad = "categoria"

    def get_queryset(self):
        consulta = Categoria.objects.select_related("edicion")
        edicion = self.request.query_params.get("edicion")
        return consulta.filter(edicion_id=edicion) if edicion else consulta


@extend_schema_view(
    list=extend_schema(parameters=[OpenApiParameter("categoria", OpenApiTypes.INT)]),
    destroy=extend_schema(responses={204: None, 409: ErrorReglaSerializer}, summary="Eliminar (solo sin votos, RN-09)"),
)
@extend_schema(tags=["Administración"])
class AdminVotacionViewSet(AuditadoMixin, viewsets.ModelViewSet):
    permission_classes = [EsAdministrador]
    serializer_class = VotacionSerializer
    entidad = "votacion"

    def get_queryset(self):
        consulta = Votacion.objects.select_related("categoria__edicion")
        categoria = self.request.query_params.get("categoria")
        return consulta.filter(categoria_id=categoria) if categoria else consulta

    def validar_eliminacion(self, votacion):
        servicios.validar_eliminacion(votacion)

    @extend_schema(summary="Publicar votación (RN-06)", request=None,
                   responses={200: VotacionSerializer, 400: ErrorReglaSerializer})
    @action(detail=True, methods=["post"])
    def publicar(self, request, pk=None):
        votacion = self.get_object()
        try:
            servicios.publicar_votacion(votacion)
        except servicios.ReglaNegocioError as error:
            return respuesta_regla(error)
        servicios.auditar(request, "publicar", self.entidad, votacion.pk)
        return Response(VotacionSerializer(votacion).data)

    @extend_schema(summary="Cerrar votación anticipadamente", request=None, responses={200: VotacionSerializer})
    @action(detail=True, methods=["post"])
    def cerrar(self, request, pk=None):
        votacion = self.get_object()
        votacion.cerrada_manualmente = True
        votacion.save(update_fields=["cerrada_manualmente", "actualizada_en"])
        servicios.auditar(request, "cerrar", self.entidad, votacion.pk)
        return Response(VotacionSerializer(votacion).data)

    @extend_schema(summary="Publicar u ocultar resultados (RF-15)", request=PublicarResultadosSerializer,
                   responses={200: VotacionSerializer})
    @action(detail=True, methods=["post"], url_path="publicar-resultados")
    def publicar_resultados(self, request, pk=None):
        votacion = self.get_object()
        votacion.resultados_publicados = bool(request.data.get("publicar", True))
        votacion.save(update_fields=["resultados_publicados", "actualizada_en"])
        servicios.auditar(
            request, "publicar_resultados", self.entidad, votacion.pk, {"publicar": votacion.resultados_publicados}
        )
        return Response(VotacionSerializer(votacion).data)

    @extend_schema(summary="Resultados completos (RF-14)", responses={200: ResultadosSerializer})
    @action(detail=True)
    def resultados(self, request, pk=None):
        return Response(servicios.calcular_resultados(self.get_object()))

    @extend_schema(summary="Exportar resultados en CSV (RF-14)",
                   responses={(200, "text/csv"): OpenApiResponse(response=OpenApiTypes.BINARY, description="Archivo CSV")})
    @action(detail=True, url_path="resultados/csv")
    def resultados_csv(self, request, pk=None):
        votacion = self.get_object()
        datos = servicios.calcular_resultados(votacion)
        respuesta = HttpResponse(content_type="text/csv; charset=utf-8")
        nombre = f"resultados-votacion-{votacion.pk}-{timezone.localdate():%Y%m%d}.csv"
        respuesta["Content-Disposition"] = f'attachment; filename="{nombre}"'
        respuesta.write("﻿")
        escritor = csv.writer(respuesta)
        escritor.writerow(["Opción", "Votos", "Porcentaje"])
        for fila in datos["resultados"]:
            escritor.writerow([fila["opcion"], fila["votos"], fila["porcentaje"]])
        escritor.writerow(["Total", datos["total_votos"], 100 if datos["total_votos"] else 0])
        servicios.auditar(request, "exportar_resultados", self.entidad, votacion.pk)
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

    def get_queryset(self):
        consulta = Opcion.objects.all()
        votacion = self.request.query_params.get("votacion")
        return consulta.filter(votacion_id=votacion) if votacion else consulta

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
        consulta = Voto.objects.all()
        votacion = self.request.query_params.get("votacion")
        return consulta.filter(votacion_id=votacion) if votacion else consulta


@extend_schema_view(
    list=extend_schema(summary="Usuarios registrados (sin contraseñas)", parameters=[
        OpenApiParameter("rol", OpenApiTypes.STR, enum=["votante", "administrador"])]),
    retrieve=extend_schema(summary="Detalle de usuario"),
)
@extend_schema(tags=["Administración"])
class AdminUsuarioViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [EsAdministrador]
    serializer_class = UsuarioAdminSerializer

    def get_queryset(self):
        consulta = Usuario.objects.order_by("id")
        rol = self.request.query_params.get("rol")
        return consulta.filter(rol=rol) if rol else consulta


class PaginacionAuditoria(PageNumberPagination):
    page_size = 50


@extend_schema(tags=["Auditoría"])
class AdminAuditoriaViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [EsAdministrador]
    serializer_class = RegistroAuditoriaSerializer
    pagination_class = PaginacionAuditoria
    queryset = RegistroAuditoria.objects.select_related("usuario")
