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
from . import selectores, servicios, servicios_2fa
from .serializers import (
    CodigoSerializer, CodigosRespaldoSerializer, ConfigurarTotpSerializer, ContrasenaSerializer, DesafioDosPasosSerializer,
    DesafioSerializer, EstadoDosPasosSerializer, VerificarDosPasosSerializer,
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


@extend_schema(
    tags=["Autenticación"], summary="Iniciar sesión (RF-02, RF-20)", request=LoginSerializer,
    description="Si la cuenta tiene la verificación en dos pasos no entrega el token: responde "
                "`{requiere_2fa: true, metodo, desafio}` y el token sale de `/api/auth/2fa/verificar/`. "
                "Con el método por correo, el código se envía en este momento.",
    responses={200: OpenApiResponse(TokenRespuestaSerializer, description="Token, o DesafioDosPasos si falta el paso 2"),
               400: OpenApiResponse(description="Credenciales incorrectas")},
)
class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        usuario = serializer.validated_data["usuario"]
        if servicios_2fa.activo(usuario):
            return Response(DesafioDosPasosSerializer({
                "requiere_2fa": True, "metodo": servicios_2fa.metodo(usuario), "desafio": servicios_2fa.crear_desafio(usuario),
            }).data)
        return respuesta_sesion(usuario)


# ---------- Verificación en dos pasos (RF-20, CU-15) ----------


class DosPasosBase(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "dos_pasos"

    def estado(self):
        return EstadoDosPasosSerializer(servicios_2fa.estado(self.request.user)).data

    def con_codigos(self, codigos):
        return Response(CodigosRespaldoSerializer(
            {"codigos_respaldo": codigos, "estado": servicios_2fa.estado(self.request.user)}).data)


@extend_schema(tags=["Verificación en dos pasos"], summary="Estado de la verificación en dos pasos de mi cuenta",
               responses={200: EstadoDosPasosSerializer})
class EstadoDosPasosView(DosPasosBase):
    throttle_classes = []

    def get(self, request):
        return Response(self.estado())


@extend_schema(tags=["Verificación en dos pasos"], summary="Empezar a configurar la app autenticadora (QR y clave)",
               description="Google Authenticator, Microsoft Authenticator, Authy… No activa nada hasta confirmar un código.",
               request=None, responses={200: ConfigurarTotpSerializer, 409: ErrorReglaSerializer})
class IniciarTotpView(DosPasosBase):
    def post(self, request):
        return Response(ConfigurarTotpSerializer(servicios_2fa.iniciar_totp(request.user)).data)


@extend_schema(tags=["Verificación en dos pasos"], summary="Activar la app autenticadora con un código",
               request=CodigoSerializer, responses={200: CodigosRespaldoSerializer, 400: ErrorReglaSerializer})
class ActivarTotpView(DosPasosBase):
    def post(self, request):
        serializer = CodigoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        codigos = servicios_2fa.activar_totp(request.user, serializer.validated_data["codigo"])
        auditar(request, "activar_2fa", "usuario", request.user.pk, {"metodo": "totp"})
        return self.con_codigos(codigos)


@extend_schema(tags=["Verificación en dos pasos"], summary="Enviar el código al correo para activar ese método",
               request=None, responses={202: OpenApiResponse(description="Código enviado"), 409: ErrorReglaSerializer,
                                        429: ErrorReglaSerializer})
class IniciarCorreoView(DosPasosBase):
    def post(self, request):
        servicios_2fa.iniciar_correo(request.user)
        return Response({"detail": f"Te enviamos un código a {request.user.email}."}, status=status.HTTP_202_ACCEPTED)


@extend_schema(tags=["Verificación en dos pasos"], summary="Activar el código por correo",
               request=CodigoSerializer, responses={200: CodigosRespaldoSerializer, 400: ErrorReglaSerializer})
class ActivarCorreoView(DosPasosBase):
    def post(self, request):
        serializer = CodigoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        codigos = servicios_2fa.activar_correo(request.user, serializer.validated_data["codigo"])
        auditar(request, "activar_2fa", "usuario", request.user.pk, {"metodo": "correo"})
        return self.con_codigos(codigos)


@extend_schema(tags=["Verificación en dos pasos"], summary="Desactivar la verificación en dos pasos (pide la contraseña)",
               request=ContrasenaSerializer, responses={200: EstadoDosPasosSerializer, 400: ErrorReglaSerializer})
class DesactivarDosPasosView(DosPasosBase):
    def post(self, request):
        serializer = ContrasenaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        servicios_2fa.desactivar(request.user, serializer.validated_data["password"])
        auditar(request, "desactivar_2fa", "usuario", request.user.pk)
        return Response(self.estado())


@extend_schema(tags=["Verificación en dos pasos"], summary="Generar nuevos códigos de respaldo (pide la contraseña)",
               request=ContrasenaSerializer, responses={200: CodigosRespaldoSerializer, 400: ErrorReglaSerializer})
class RegenerarCodigosView(DosPasosBase):
    def post(self, request):
        serializer = ContrasenaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        codigos = servicios_2fa.regenerar_codigos(request.user, serializer.validated_data["password"])
        auditar(request, "regenerar_codigos_2fa", "usuario", request.user.pk)
        return self.con_codigos(codigos)


@extend_schema(tags=["Verificación en dos pasos"], summary="Paso 2 del inicio de sesión: verificar el código",
               request=VerificarDosPasosSerializer,
               responses={200: TokenRespuestaSerializer, 400: ErrorReglaSerializer, 429: ErrorReglaSerializer})
class VerificarDosPasosView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "dos_pasos"

    def post(self, request):
        serializer = VerificarDosPasosSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        usuario = servicios_2fa.usuario_del_desafio(serializer.validated_data["desafio"])
        if servicios_2fa.verificar(usuario, serializer.validated_data["codigo"]):
            auditar(request, "usar_codigo_respaldo_2fa", "usuario", usuario.pk)
        return respuesta_sesion(usuario)


@extend_schema(tags=["Verificación en dos pasos"], summary="Reenviar el código del paso 2 al correo",
               request=DesafioSerializer,
               responses={202: OpenApiResponse(description="Código enviado"), 400: ErrorReglaSerializer,
                          409: ErrorReglaSerializer, 429: ErrorReglaSerializer})
class ReenviarCodigoDosPasosView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "confirmacion"

    def post(self, request):
        serializer = DesafioSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        usuario = servicios_2fa.usuario_del_desafio(serializer.validated_data["desafio"])
        servicios_2fa.reenviar_codigo(usuario)
        return Response({"detail": "Te enviamos un código nuevo."}, status=status.HTTP_202_ACCEPTED)


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
    permisos_accion = {"list": "usuarios.ver", "retrieve": "usuarios.ver", "rol": "usuarios.cambiar_rol",
                       "quitar_2fa": "usuarios.quitar_2fa"}
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

    @extend_schema(summary="Quitar la verificación en dos pasos de una cuenta (R-11)",
                   description="Para quien perdió el celular y los códigos de respaldo. Exige motivo (mínimo 20 "
                               "caracteres): queda en la auditoría y se le envía por correo a la persona.",
                   request={"application/json": {"type": "object", "properties": {"motivo": {"type": "string"}}}},
                   responses={200: UsuarioAdminSerializer, 400: ErrorReglaSerializer, 403: ErrorReglaSerializer,
                              409: ErrorReglaSerializer})
    @action(detail=True, methods=["post"], url_path="quitar-2fa")
    def quitar_2fa(self, request, pk=None):
        usuario = self.get_object()
        metodo, motivo = servicios_2fa.quitar_por_administracion(request.user, usuario, request.data.get("motivo", ""))
        auditar(request, "quitar_2fa", "usuario", usuario.pk, {"email": usuario.email, "metodo": metodo, "motivo": motivo})
        return Response(self.get_serializer(selectores.usuarios().get(pk=usuario.pk)).data)


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
