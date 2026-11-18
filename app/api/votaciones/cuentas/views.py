from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import generics, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from ..auditoria.mixins import auditar
from ..comun.api import ErrorReglaSerializer
from ..comun.permisos import TienePermiso, lectura_escritura
from . import permisos as catalogo
from .models import Rol
from . import selectores, servicios
from .serializers import (
    CompletarDocumentoSerializer, ConfirmarCorreoSerializer, LoginSerializer, RegistroSerializer, TokenRespuestaSerializer,
    RolSerializer, UsuarioAdminSerializer, UsuarioSerializer,
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


@extend_schema(tags=["Autenticación"], summary="Completar el documento para poder votar",
               description="Para cuentas creadas sin documento cuando la administración empieza a pedirlo. "
                           "Se registra una sola vez; con la misma validación del registro (una cuenta por documento).",
               request=CompletarDocumentoSerializer,
               responses={200: UsuarioSerializer, 400: OpenApiResponse(description="Documento inválido o ya usado"),
                          409: ErrorReglaSerializer})
class CompletarDocumentoView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "registro"  # mismo límite que el registro: evita probar documentos ajenos

    def post(self, request):
        serializer = CompletarDocumentoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        usuario = servicios.completar_documento(request.user, **serializer.validated_data)
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
        OpenApiParameter("rol", OpenApiTypes.STR, description="Código del rol: votante, lectura, editor, administrador…")]),
    retrieve=extend_schema(summary="Detalle de usuario"),
)
@extend_schema(tags=["Administración"])
class AdminUsuarioViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [TienePermiso]
    permisos_accion = {"list": "usuarios.ver", "retrieve": "usuarios.ver", "rol": "usuarios.cambiar_rol"}
    serializer_class = UsuarioAdminSerializer

    def get_queryset(self):
        return selectores.usuarios(self.request.query_params.get("rol"))

    def get_serializer_context(self):
        return {**super().get_serializer_context(), "nombres_roles": dict(Rol.objects.values_list("codigo", "nombre"))}

    @extend_schema(summary="Cambiar el rol de un usuario",
                   request={"application/json": {"type": "object", "properties": {"rol": {"type": "string"}}}},
                   responses={200: UsuarioAdminSerializer, 400: ErrorReglaSerializer, 403: ErrorReglaSerializer})
    @action(detail=True, methods=["post"])
    def rol(self, request, pk=None):
        usuario = servicios.cambiar_rol(request.user, self.get_object(), request.data.get("rol", ""))
        auditar(request, "cambiar_rol", "usuario", usuario.pk, {"email": usuario.email, "rol": usuario.rol})
        return Response(self.get_serializer(usuario).data)


@extend_schema_view(
    list=extend_schema(summary="Roles con sus permisos y el número de usuarios"),
    retrieve=extend_schema(summary="Detalle de un rol"),
    create=extend_schema(summary="Crear un rol (solo con permisos que tenga quien lo crea)"),
    update=extend_schema(summary="Cambiar nombre, descripción y permisos de un rol"),
    partial_update=extend_schema(summary="Cambiar nombre, descripción o permisos de un rol"),
    destroy=extend_schema(summary="Eliminar un rol sin usuarios (los del sistema no se eliminan)",
                          responses={204: None, 400: ErrorReglaSerializer, 409: ErrorReglaSerializer}),
)
@extend_schema(tags=["Administración"])
class AdminRolViewSet(viewsets.ModelViewSet):
    permission_classes = [TienePermiso]
    permisos_accion = lectura_escritura("roles.ver", "roles.gestionar", catalogo="roles.ver")
    serializer_class = RolSerializer
    queryset = Rol.objects.all()

    def perform_create(self, serializer):
        rol = servicios.guardar_rol(self.request.user, serializer.validated_data)
        serializer.instance = rol
        auditar(self.request, "crear", "rol", rol.pk, {"codigo": rol.codigo, "permisos": rol.permisos})

    def perform_update(self, serializer):
        rol = servicios.guardar_rol(self.request.user, serializer.validated_data, serializer.instance)
        auditar(self.request, "actualizar", "rol", rol.pk, {"codigo": rol.codigo, "permisos": sorted(rol.permisos_efectivos)})

    def perform_destroy(self, rol):
        pk, codigo = rol.pk, rol.codigo
        servicios.eliminar_rol(self.request.user, rol)
        auditar(self.request, "eliminar", "rol", pk, {"codigo": codigo})

    @extend_schema(summary="Catálogo de permisos agrupado (cada funcionalidad del panel es un permiso)",
                   responses={200: OpenApiTypes.OBJECT})
    @action(detail=False, pagination_class=None)
    def catalogo(self, request):
        return Response([{"grupo": grupo, "permisos": [{"codigo": c, "descripcion": d} for c, d in lista]}
                         for grupo, lista in catalogo.GRUPOS])
