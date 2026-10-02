import csv

from django.db.models import ProtectedError
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
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
from .models import Categoria, Edicion, Opcion, RegistroAuditoria, Votacion, Voto
from .permissions import EsAdministrador
from .serializers import (
    CategoriaSerializer,
    EdicionSerializer,
    LoginSerializer,
    OpcionSerializer,
    RegistroAuditoriaSerializer,
    RegistroSerializer,
    UsuarioSerializer,
    VotacionDetalleSerializer,
    VotacionPublicaSerializer,
    VotacionSerializer,
    VotarSerializer,
    VotoSerializer,
)


def respuesta_regla(error):
    return Response({"detail": error.mensaje, "codigo": error.codigo}, status=error.status)


def respuesta_auth(usuario, codigo_http=status.HTTP_200_OK):
    token, _ = Token.objects.get_or_create(user=usuario)
    return Response({"token": token.key, "usuario": UsuarioSerializer(usuario).data}, status=codigo_http)


class RegistroView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "registro"

    def post(self, request):
        serializer = RegistroSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        usuario = serializer.save()
        return respuesta_auth(usuario, status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        return respuesta_auth(serializer.validated_data["usuario"])


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PerfilView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UsuarioSerializer

    def get_object(self):
        return self.request.user


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


class CategoriaPublicaViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    serializer_class = CategoriaSerializer

    def get_queryset(self):
        consulta = Categoria.objects.filter(activa=True)
        edicion = self.request.query_params.get("edicion")
        if edicion:
            return consulta.filter(edicion_id=edicion)
        return consulta.filter(edicion__estado=Edicion.Estado.ACTIVA)


class VotacionPublicaViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [AllowAny]
    throttle_scope = None

    def get_queryset(self):
        consulta = Votacion.objects.filter(publicada=True, categoria__activa=True).select_related(
            "categoria__edicion"
        )
        categoria = self.request.query_params.get("categoria")
        if categoria:
            consulta = consulta.filter(categoria_id=categoria)
        return consulta

    def get_serializer_class(self):
        return VotacionDetalleSerializer if self.action == "retrieve" else VotacionPublicaSerializer

    def list(self, request, *args, **kwargs):
        votaciones = list(self.get_queryset())
        estado = request.query_params.get("estado")
        if estado:
            votaciones = [v for v in votaciones if v.estado == estado]
        return Response(self.get_serializer(votaciones, many=True).data)

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

    @action(detail=True)
    def resultados(self, request, pk=None):
        votacion = self.get_object()
        if not servicios.resultados_visibles_para(votacion, request.user):
            raise PermissionDenied("Los resultados de esta votación aún no son públicos (RN-07).")
        return Response(servicios.calcular_resultados(votacion))


class MisVotosView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = VotoSerializer

    def get_queryset(self):
        return Voto.objects.filter(usuario=self.request.user).select_related("votacion", "opcion")


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


class AdminEdicionViewSet(AuditadoMixin, viewsets.ModelViewSet):
    permission_classes = [EsAdministrador]
    serializer_class = EdicionSerializer
    queryset = Edicion.objects.all()
    entidad = "edicion"


class AdminCategoriaViewSet(AuditadoMixin, viewsets.ModelViewSet):
    permission_classes = [EsAdministrador]
    serializer_class = CategoriaSerializer
    entidad = "categoria"

    def get_queryset(self):
        consulta = Categoria.objects.all()
        edicion = self.request.query_params.get("edicion")
        return consulta.filter(edicion_id=edicion) if edicion else consulta


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

    @action(detail=True, methods=["post"])
    def publicar(self, request, pk=None):
        votacion = self.get_object()
        try:
            servicios.publicar_votacion(votacion)
        except servicios.ReglaNegocioError as error:
            return respuesta_regla(error)
        servicios.auditar(request, "publicar", self.entidad, votacion.pk)
        return Response(VotacionSerializer(votacion).data)

    @action(detail=True, methods=["post"])
    def cerrar(self, request, pk=None):
        votacion = self.get_object()
        votacion.cerrada_manualmente = True
        votacion.save(update_fields=["cerrada_manualmente", "actualizada_en"])
        servicios.auditar(request, "cerrar", self.entidad, votacion.pk)
        return Response(VotacionSerializer(votacion).data)

    @action(detail=True, methods=["post"], url_path="publicar-resultados")
    def publicar_resultados(self, request, pk=None):
        votacion = self.get_object()
        votacion.resultados_publicados = bool(request.data.get("publicar", True))
        votacion.save(update_fields=["resultados_publicados", "actualizada_en"])
        servicios.auditar(
            request, "publicar_resultados", self.entidad, votacion.pk, {"publicar": votacion.resultados_publicados}
        )
        return Response(VotacionSerializer(votacion).data)

    @action(detail=True)
    def resultados(self, request, pk=None):
        return Response(servicios.calcular_resultados(self.get_object()))

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


class PaginacionAuditoria(PageNumberPagination):
    page_size = 50


class AdminAuditoriaViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [EsAdministrador]
    serializer_class = RegistroAuditoriaSerializer
    pagination_class = PaginacionAuditoria
    queryset = RegistroAuditoria.objects.select_related("usuario")
