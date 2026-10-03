import re

from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import (
    BannerInicio, Categoria, ConfiguracionSitio, Edicion, Opcion, RedSocial, RegistroAuditoria, Usuario, Votacion, Voto,
)
from .servicios import votos_del_usuario


class UsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = ["id", "email", "nombres", "apellidos", "rol", "fecha_registro"]
        read_only_fields = fields


class RegistroSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = Usuario
        fields = ["email", "nombres", "apellidos", "password", "acepta_tratamiento_datos"]
        # La unicidad del correo se valida en validate_email (sin distinguir mayúsculas y con un mensaje claro)
        extra_kwargs = {"email": {"validators": []}}

    def validate_email(self, valor):
        valor = valor.lower()
        if Usuario.objects.filter(email=valor).exists():
            raise serializers.ValidationError("Ya existe una cuenta con este correo.")
        return valor

    def validate_acepta_tratamiento_datos(self, valor):
        if not valor:
            raise serializers.ValidationError(
                "Debes aceptar la política de tratamiento de datos personales."
            )
        return valor

    def validate(self, datos):
        validate_password(datos["password"], Usuario(email=datos.get("email"), nombres=datos.get("nombres", "")))
        return datos

    def create(self, datos):
        return Usuario.objects.create_user(**datos)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, datos):
        usuario = authenticate(
            request=self.context.get("request"), email=datos["email"].lower(), password=datos["password"]
        )
        if not usuario:
            raise serializers.ValidationError("Correo o contraseña incorrectos.")
        datos["usuario"] = usuario
        return datos


TAMANO_MAXIMO_IMAGEN = 3 * 1024 * 1024
TAMANO_MAXIMO_ICONO = 1 * 1024 * 1024
TAMANO_MAXIMO_AUDIO = 10 * 1024 * 1024
FORMATOS_IMAGEN = {"JPEG", "PNG", "WEBP"}
EXTENSIONES_AUDIO = (".mp3", ".ogg", ".wav", ".m4a", ".webm")


class RutaArchivoMixin:
    """Devuelve la ruta absoluta del sitio (/media/…), sin dominio. Un valor vacío o nulo quita el archivo."""

    def to_representation(self, valor):
        return valor.url if valor else None

    def validate_empty_values(self, datos):
        if datos in ("", None) and not self.required:
            return True, ""
        return super().validate_empty_values(datos)


class RutaImagenField(RutaArchivoMixin, serializers.ImageField):
    pass


class RutaArchivoField(RutaArchivoMixin, serializers.FileField):
    pass


def validar_icono(archivo):
    if not archivo:
        return archivo
    if archivo.size > TAMANO_MAXIMO_ICONO:
        raise serializers.ValidationError("El ícono supera el tamaño máximo de 1 MB.")
    formato = getattr(getattr(archivo, "image", None), "format", None)
    if formato not in FORMATOS_IMAGEN:
        raise serializers.ValidationError("Formato no permitido: usa una imagen JPG, PNG o WebP.")
    return archivo


def validar_audio(archivo):
    if not archivo:
        return archivo
    if archivo.size > TAMANO_MAXIMO_AUDIO:
        raise serializers.ValidationError("El audio supera el tamaño máximo de 10 MB.")
    tipo = getattr(archivo, "content_type", "") or ""
    if not archivo.name.lower().endswith(EXTENSIONES_AUDIO) or (tipo and not tipo.startswith(("audio/", "video/webm"))):
        raise serializers.ValidationError("Formato no permitido: usa un archivo MP3, OGG, WAV, M4A o WebM.")
    return archivo


class EdicionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Edicion
        fields = ["id", "nombre", "anio", "fecha_inicio", "fecha_fin", "estado", "presentacion_categorias"]

    def validate(self, datos):
        inicio = datos.get("fecha_inicio", getattr(self.instance, "fecha_inicio", None))
        fin = datos.get("fecha_fin", getattr(self.instance, "fecha_fin", None))
        if inicio and fin and fin < inicio:
            raise serializers.ValidationError({"fecha_fin": "Debe ser igual o posterior a la fecha de inicio."})
        return datos


PATRON_SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def validar_slug(valor):
    valor = (valor or "").strip().lower()
    if valor and not PATRON_SLUG.match(valor):
        raise serializers.ValidationError(
            "Usa solo letras minúsculas sin tildes, números y guiones (p. ej. «cancion-favorita»)."
        )
    return valor


def validar_enlace_multimedia(valor):
    """Acepta una URL absoluta http(s) o una ruta relativa al sitio que empiece por «/»."""
    valor = (valor or "").strip()
    if not valor:
        return valor
    if valor.startswith("/") and not valor.startswith("//") and " " not in valor:
        return valor
    try:
        URLValidator(schemes=["http", "https"])(valor)
    except DjangoValidationError:
        raise serializers.ValidationError(
            "Ingresa una URL que empiece por http:// o https://, o una ruta del sitio que empiece por «/»."
        )
    return valor


class SlugOpcionalMixin:
    """El slug es opcional (se genera desde el nombre o título), así que su unicidad se valida aparte."""

    campo_ambito = ""

    def get_unique_together_validators(self):
        return [v for v in super().get_unique_together_validators() if "slug" not in v.fields]

    def validate_slug(self, valor):
        return validar_slug(valor)

    def validar_slug_unico(self, datos):
        slug = datos.get("slug")
        ambito = datos.get(self.campo_ambito, getattr(self.instance, self.campo_ambito, None))
        if not slug or ambito is None:
            return
        repetidos = self.Meta.model.objects.filter(**{self.campo_ambito: ambito, "slug": slug})
        if self.instance is not None:
            repetidos = repetidos.exclude(pk=self.instance.pk)
        if repetidos.exists():
            raise serializers.ValidationError({"slug": "Ya existe otro elemento con este identificador de URL."})


class CategoriaSerializer(SlugOpcionalMixin, serializers.ModelSerializer):
    campo_ambito = "edicion"
    edicion_anio = serializers.IntegerField(source="edicion.anio", read_only=True)
    icono_imagen = RutaImagenField(required=False, allow_null=True)

    class Meta:
        model = Categoria
        fields = ["id", "edicion", "edicion_anio", "nombre", "slug", "descripcion", "icono", "icono_imagen", "activa", "orden"]
        extra_kwargs = {"slug": {"required": False}}

    def validate_icono_imagen(self, archivo):
        return validar_icono(archivo)

    def validate(self, datos):
        self.validar_slug_unico(datos)
        return datos


class OpcionSerializer(serializers.ModelSerializer):
    audio = RutaArchivoField(required=False, allow_null=True)

    class Meta:
        model = Opcion
        fields = [
            "id", "votacion", "nombre", "descripcion", "imagen", "enlace_multimedia", "audio", "texto_audio", "orden", "activa",
        ]

    def validate_enlace_multimedia(self, valor):
        return validar_enlace_multimedia(valor)

    def validate_audio(self, archivo):
        return validar_audio(archivo)


class OpcionPublicaSerializer(serializers.ModelSerializer):
    audio = RutaArchivoField(read_only=True)

    class Meta:
        model = Opcion
        fields = ["id", "nombre", "descripcion", "imagen", "enlace_multimedia", "audio", "texto_audio", "orden"]


class OpcionListadoPublicoSerializer(OpcionPublicaSerializer):
    class Meta(OpcionPublicaSerializer.Meta):
        fields = ["id", "votacion"] + OpcionPublicaSerializer.Meta.fields[1:]


class VotacionSerializer(SlugOpcionalMixin, serializers.ModelSerializer):
    campo_ambito = "categoria"
    estado = serializers.CharField(read_only=True)
    categoria_slug = serializers.CharField(source="categoria.slug", read_only=True)
    edicion_anio = serializers.IntegerField(source="categoria.edicion.anio", read_only=True)
    icono_imagen = RutaImagenField(required=False, allow_null=True)

    class Meta:
        model = Votacion
        fields = [
            "id", "categoria", "categoria_slug", "edicion_anio", "titulo", "slug", "descripcion", "imagen", "icono_imagen",
            "presentacion_opciones", "fecha_apertura", "fecha_cierre",
            "votos_por_usuario", "visibilidad_resultados", "estado", "publicada", "cerrada_manualmente",
            "resultados_publicados", "creada_en", "actualizada_en",
        ]
        read_only_fields = ["publicada", "cerrada_manualmente", "resultados_publicados", "creada_en", "actualizada_en"]
        extra_kwargs = {"slug": {"required": False}}

    def validate_icono_imagen(self, archivo):
        return validar_icono(archivo)

    def validate(self, datos):
        self.validar_slug_unico(datos)
        apertura = datos.get("fecha_apertura", getattr(self.instance, "fecha_apertura", None))
        cierre = datos.get("fecha_cierre", getattr(self.instance, "fecha_cierre", None))
        if apertura and cierre and cierre <= apertura:
            raise serializers.ValidationError({"fecha_cierre": "Debe ser posterior a la fecha de apertura."})
        return datos


class VotacionPublicaSerializer(serializers.ModelSerializer):
    estado = serializers.CharField(read_only=True)
    categoria_nombre = serializers.CharField(source="categoria.nombre", read_only=True)
    categoria_slug = serializers.CharField(source="categoria.slug", read_only=True)
    edicion_anio = serializers.IntegerField(source="categoria.edicion.anio", read_only=True)
    icono_imagen = RutaImagenField(read_only=True)

    class Meta:
        model = Votacion
        fields = [
            "id", "categoria", "categoria_nombre", "categoria_slug", "edicion_anio", "titulo", "slug", "descripcion", "imagen",
            "icono_imagen", "presentacion_opciones", "fecha_apertura", "fecha_cierre", "votos_por_usuario",
            "visibilidad_resultados", "estado",
        ]


class VotacionDetalleSerializer(VotacionPublicaSerializer):
    opciones = serializers.SerializerMethodField()
    mis_votos = serializers.SerializerMethodField()

    class Meta(VotacionPublicaSerializer.Meta):
        fields = VotacionPublicaSerializer.Meta.fields + ["opciones", "mis_votos"]

    @extend_schema_field(OpcionPublicaSerializer(many=True))
    def get_opciones(self, votacion):
        return OpcionPublicaSerializer(votacion.opciones.filter(activa=True), many=True).data

    @extend_schema_field(serializers.IntegerField())
    def get_mis_votos(self, votacion):
        request = self.context.get("request")
        return votos_del_usuario(request.user, votacion) if request else 0


class VotarSerializer(serializers.Serializer):
    opcion = serializers.IntegerField(min_value=1)


class VotoSerializer(serializers.ModelSerializer):
    votacion_titulo = serializers.CharField(source="votacion.titulo", read_only=True)
    votacion_slug = serializers.CharField(source="votacion.slug", read_only=True)
    categoria_slug = serializers.CharField(source="votacion.categoria.slug", read_only=True)
    edicion_anio = serializers.IntegerField(source="votacion.categoria.edicion.anio", read_only=True)
    opcion_nombre = serializers.CharField(source="opcion.nombre", read_only=True)

    class Meta:
        model = Voto
        fields = [
            "id", "votacion", "votacion_titulo", "votacion_slug", "categoria_slug", "edicion_anio", "opcion",
            "opcion_nombre", "fecha_hora", "codigo_comprobante",
        ]
        read_only_fields = fields


class BannerInicioSerializer(serializers.ModelSerializer):
    imagen = RutaImagenField()
    edicion_anio = serializers.IntegerField(source="edicion.anio", read_only=True)

    class Meta:
        model = BannerInicio
        fields = ["id", "edicion", "edicion_anio", "titulo", "subtitulo", "imagen", "texto_alternativo", "texto_boton", "enlace_boton", "orden", "activo"]

    def validate_imagen(self, archivo):
        if archivo.size > TAMANO_MAXIMO_IMAGEN:
            raise serializers.ValidationError("La imagen supera el tamaño máximo de 3 MB.")
        formato = getattr(getattr(archivo, "image", None), "format", None)
        if formato not in FORMATOS_IMAGEN:
            raise serializers.ValidationError("Formato no permitido: usa una imagen JPG, PNG o WebP.")
        return archivo

    def validate_enlace_boton(self, valor):
        return validar_enlace_multimedia(valor)


class ConfiguracionSitioSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfiguracionSitio
        fields = ["nombre_organizacion", "telefono", "direccion", "correo", "texto_pie", "modo_banner"]


class RedSocialSerializer(serializers.ModelSerializer):
    class Meta:
        model = RedSocial
        fields = ["id", "nombre", "url", "icono", "orden", "activa"]


class SitioSerializer(serializers.Serializer):
    configuracion = ConfiguracionSitioSerializer()
    redes = RedSocialSerializer(many=True)
    banners = BannerInicioSerializer(many=True)


class VotoAdminSerializer(serializers.ModelSerializer):
    """Voto sin datos del votante ni comprobante (secreto del voto, RNF-08): solo para conteos."""

    class Meta:
        model = Voto
        fields = ["id", "votacion", "opcion", "fecha_hora"]
        read_only_fields = fields


class UsuarioAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = ["id", "email", "nombres", "apellidos", "rol", "is_active", "fecha_registro"]
        read_only_fields = fields


class RegistroAuditoriaSerializer(serializers.ModelSerializer):
    usuario = serializers.StringRelatedField()

    class Meta:
        model = RegistroAuditoria
        fields = ["id", "usuario", "accion", "entidad", "entidad_id", "detalle", "fecha_hora", "ip"]
        read_only_fields = fields


class TokenRespuestaSerializer(serializers.Serializer):
    token = serializers.CharField(help_text="Usar como encabezado `Authorization: Token <token>`.")
    usuario = UsuarioSerializer()


class ErrorReglaSerializer(serializers.Serializer):
    detail = serializers.CharField(help_text="Mensaje legible; cita la regla de negocio (RN-xx).")
    codigo = serializers.CharField(
        help_text="votacion_no_abierta · opcion_invalida · limite_votos · opciones_insuficientes · tiene_votos · registros_asociados"
    )


class FilaResultadoSerializer(serializers.Serializer):
    opcion_id = serializers.IntegerField()
    opcion = serializers.CharField()
    votos = serializers.IntegerField()
    porcentaje = serializers.FloatField()


class ResultadosSerializer(serializers.Serializer):
    votacion_id = serializers.IntegerField()
    votacion = serializers.CharField()
    estado = serializers.ChoiceField(choices=Votacion.Estado.choices)
    total_votos = serializers.IntegerField()
    resultados = FilaResultadoSerializer(many=True)


class PublicarResultadosSerializer(serializers.Serializer):
    publicar = serializers.BooleanField(default=True)


class VotanteParticipacionSerializer(serializers.Serializer):
    usuario_id = serializers.IntegerField()
    nombres = serializers.CharField()
    apellidos = serializers.CharField()
    email = serializers.EmailField()
    fecha = serializers.DateField(help_text="Día del primer voto (sin hora, para no correlacionar con los resultados).")


class ParticipacionSerializer(serializers.Serializer):
    votacion_id = serializers.IntegerField()
    votacion = serializers.CharField()
    estado = serializers.ChoiceField(choices=Votacion.Estado.choices)
    umbral = serializers.IntegerField()
    total_votos = serializers.IntegerField()
    total_votantes = serializers.IntegerField()
    disponible = serializers.BooleanField()
    motivo = serializers.CharField(allow_blank=True)
    votantes = VotanteParticipacionSerializer(many=True)
    ocultos = serializers.IntegerField()


class OpcionResumenSerializer(serializers.Serializer):
    opcion_id = serializers.IntegerField()
    nombre = serializers.CharField()
    votos = serializers.IntegerField()
    porcentaje = serializers.FloatField()


class VotacionResumenSerializer(serializers.Serializer):
    votacion_id = serializers.IntegerField()
    titulo = serializers.CharField()
    estado = serializers.ChoiceField(choices=Votacion.Estado.choices)
    publicada = serializers.BooleanField()
    total_votos = serializers.IntegerField()
    opciones = OpcionResumenSerializer(many=True)


class CategoriaResumenSerializer(serializers.Serializer):
    categoria_id = serializers.IntegerField()
    nombre = serializers.CharField()
    icono = serializers.CharField(allow_blank=True)
    icono_imagen = serializers.CharField(allow_null=True)
    total_votos = serializers.IntegerField()
    votaciones = VotacionResumenSerializer(many=True)


class ResumenEdicionSerializer(serializers.Serializer):
    edicion_id = serializers.IntegerField()
    edicion = serializers.CharField()
    total_votos = serializers.IntegerField()
    categorias = CategoriaResumenSerializer(many=True)


class IntegridadVotacionSerializer(serializers.Serializer):
    votacion_id = serializers.IntegerField()
    titulo = serializers.CharField()
    categoria = serializers.CharField()
    estado = serializers.ChoiceField(choices=Votacion.Estado.choices)
    votos_por_usuario = serializers.IntegerField()
    total_votos = serializers.IntegerField()
    suma_por_opcion = serializers.IntegerField()
    votantes_unicos = serializers.IntegerField()
    usuarios_excedidos = serializers.IntegerField(help_text="Usuarios con más votos de los permitidos.")
    votos_opcion_ajena = serializers.IntegerField(help_text="Votos por una opción de otra votación.")
    votos_inactivos = serializers.IntegerField(help_text="Votos por una opción desactivada.")
    votos_fuera_de_plazo = serializers.IntegerField()
    comprobantes_duplicados = serializers.IntegerField()
    ok = serializers.BooleanField()
    alertas = serializers.ListField(child=serializers.CharField())


class IntegridadResumenSerializer(serializers.Serializer):
    total_votos = serializers.IntegerField()
    votantes_unicos = serializers.IntegerField()
    votaciones = serializers.IntegerField()
    votaciones_con_alertas = serializers.IntegerField()


class IntegridadSerializer(serializers.Serializer):
    edicion_id = serializers.IntegerField()
    edicion = serializers.CharField()
    generado = serializers.DateTimeField()
    ok = serializers.BooleanField()
    resumen = IntegridadResumenSerializer()
    votaciones = IntegridadVotacionSerializer(many=True)
