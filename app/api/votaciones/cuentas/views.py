from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import generics, status, viewsets
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from ..comun.api import ErrorReglaSerializer
from ..comun.permisos import EsAdministrador
from . import selectores, servicios
from .serializers import (
    ConfirmarCorreoSerializer, LoginSerializer, RegistroSerializer, TokenRespuestaSerializer, UsuarioAdminSerializer,
    UsuarioSerializer,
)


def respuesta_sesion(usuario, codigo_http=status.HTTP_200_OK):
    return Response(
        {"token": servicios.token_sesion(usuario), "usuario": UsuarioSerializer(usuario).data}, status=codigo_http
    )


@extend_schema(tags=["Autenticación"], summary="Registrar votante (RF-01, RN-10)", request=RegistroSerializer,
               responses={201: TokenRespuestaSerializer, 400: OpenApiResponse(description="Datos inválidos")})
class RegistroView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "registro"

    def post(self, request):
        serializer = RegistroSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        usuario = servicios.registrar_votante(**serializer.validated_data)
        return respuesta_sesion(usuario, status.HTTP_201_CREATED)


@extend_schema(tags=["Autenticación"], summary="Confirmar el correo con el enlace recibido",
               request=ConfirmarCorreoSerializer,
               responses={200: UsuarioSerializer, 400: ErrorReglaSerializer})
class ConfirmarCorreoView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "confirmacion"

    def post(self, request):
        serializer = ConfirmarCorreoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        usuario, _ = servicios.confirmar_correo(serializer.validated_data["token"])
        return Response(UsuarioSerializer(usuario).data)


@extend_schema(tags=["Autenticación"], summary="Reenviar el correo de confirmación", request=None,
               responses={202: OpenApiResponse(description="Correo programado"), 409: ErrorReglaSerializer})
class ReenviarConfirmacionView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "confirmacion"

    def post(self, request):
        servicios.reenviar_confirmacion(request.user)
        return Response({"detail": f"Te enviamos un nuevo enlace a {request.user.email}."}, status=status.HTTP_202_ACCEPTED)


@extend_schema(tags=["Autenticación"], summary="Iniciar sesión (RF-02)", request=LoginSerializer,
               responses={200: TokenRespuestaSerializer, 400: OpenApiResponse(description="Credenciales incorrectas")})
class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        return respuesta_sesion(serializer.validated_data["usuario"])


@extend_schema(tags=["Autenticación"], summary="Cerrar sesión (invalida el token)", request=None, responses={204: None})
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        servicios.cerrar_sesion(request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["Autenticación"], summary="Usuario autenticado")
class PerfilView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UsuarioSerializer

    def get_object(self):
        return self.request.user


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
        return selectores.usuarios(self.request.query_params.get("rol"))
