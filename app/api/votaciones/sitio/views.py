from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics, viewsets
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from ..auditoria.mixins import AuditadoMixin, auditar
from rest_framework.exceptions import PermissionDenied

from ..comun.permisos import TienePermiso, lectura_escritura
from . import demo, selectores
from .models import ConfiguracionSitio, RedSocial, Revista
from .serializers import (
    BannerInicioSerializer, ConfiguracionSitioSerializer, RedSocialSerializer, RevistaSerializer, SitioSerializer,
)


# Contenido del sitio público (pie, banner, textos, marca): se cambia con sitio.editar o configuracion.editar
CAMPOS_SITIO = {
    "nombre_organizacion", "telefono", "direccion", "correo", "texto_pie", "modo_banner", "marca", "aviso_superior",
    "subtitulo_logo", "texto_acerca", "mostrar_equipo",
}


@extend_schema(tags=["Consulta pública"], summary="Contenido del sitio: contacto, redes, revistas y banners activos de la edición activa",
               responses={200: SitioSerializer})
class SitioView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(SitioSerializer(selectores.contenido_publico()).data)


@extend_schema_view(list=extend_schema(parameters=[OpenApiParameter("edicion", OpenApiTypes.INT, description="ID de la edición")]))
@extend_schema(tags=["Administración"])
class AdminBannerViewSet(AuditadoMixin, viewsets.ModelViewSet):
    """Banners del inicio por edición. La imagen se envía como multipart/form-data (JPG, PNG o WebP, máximo 3 MB)."""

    permission_classes = [TienePermiso]
    permisos_accion = lectura_escritura("sitio.ver", "sitio.editar")
    serializer_class = BannerInicioSerializer
    entidad = "banner"
    campos_archivo = ("imagen",)

    def get_queryset(self):
        return selectores.banners(self.request.query_params.get("edicion"))


@extend_schema(tags=["Administración"])
class AdminRevistaViewSet(AuditadoMixin, viewsets.ModelViewSet):
    """Revistas institucionales del inicio. El PDF se envía como multipart/form-data (máximo 50 MB)."""

    permission_classes = [TienePermiso]
    permisos_accion = lectura_escritura("sitio.ver", "sitio.editar")
    serializer_class = RevistaSerializer
    queryset = Revista.objects.all()
    entidad = "revista"
    campos_archivo = ("archivo",)


@extend_schema(tags=["Administración"])
class AdminRedSocialViewSet(AuditadoMixin, viewsets.ModelViewSet):
    permission_classes = [TienePermiso]
    permisos_accion = lectura_escritura("sitio.ver", "sitio.editar")
    serializer_class = RedSocialSerializer
    queryset = RedSocial.objects.all()
    entidad = "red_social"


@extend_schema_view(
    get=extend_schema(summary="Datos de contacto del pie de página"),
    put=extend_schema(summary="Actualizar datos de contacto"),
    patch=extend_schema(summary="Actualizar datos de contacto (parcial)"),
)
@extend_schema(tags=["Administración"])
class AdminConfiguracionView(generics.RetrieveUpdateAPIView):
    # Se lee con cualquier rol del panel; al guardar se exige el permiso de cada campo que cambia
    permission_classes = [TienePermiso]
    permisos_metodo = {"GET": "panel.ver", "PUT": "panel.ver", "PATCH": "panel.ver"}
    serializer_class = ConfiguracionSitioSerializer

    def get_object(self):
        return ConfiguracionSitio.obtener()

    def perform_update(self, serializer):
        cambiados = [campo for campo, valor in serializer.validated_data.items() if getattr(serializer.instance, campo) != valor]
        for campo in cambiados:
            opciones = ("sitio.editar", "configuracion.editar") if campo in CAMPOS_SITIO else ("configuracion.editar",)
            if not any(self.request.user.tiene_permiso(codigo) for codigo in opciones):
                raise PermissionDenied(f"Tu rol no tiene permiso para cambiar «{campo}».")
        serializer.save()
        auditar(self.request, "actualizar", "configuracion", 1, serializer.data)


@extend_schema(tags=["Administración"])
class AdminDemoView(APIView):
    """Datos de demostración (cargar_demo): resumen y acciones para eliminarlos o volver a cargarlos."""

    permission_classes = [TienePermiso]
    permisos_metodo = {"GET": "configuracion.ver"}

    @extend_schema(summary="Resumen de los datos de demostración", responses={200: OpenApiTypes.OBJECT})
    def get(self, request):
        return Response({**demo.resumen(), "anios": list(demo.ANIOS_DEMO), "es_cuenta_demo": demo.es_cuenta_demo(request.user.email)})


@extend_schema(tags=["Administración"], request=None, responses={200: OpenApiTypes.OBJECT})
class AdminDemoAccionView(APIView):
    permission_classes = [TienePermiso]
    permisos_metodo = {"POST": "configuracion.demo"}
    accion = ""

    @extend_schema(summary="Eliminar o volver a cargar los datos de demostración (exige un administrador propio)")
    def post(self, request):
        funcion = demo.eliminar if self.accion == "eliminar" else demo.cargar
        resultado = funcion(request.user)  # ReglaNegocioError → 400 con {"detail"}
        auditar(request, f"{self.accion}_demo", "configuracion", 1, {"resultado": resultado})
        return Response({"resultado": resultado, **demo.resumen()})

