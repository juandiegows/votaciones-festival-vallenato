import re

from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import Categoria, Edicion, Opcion, RegistroAuditoria, Usuario, Votacion, Voto
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


class EdicionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Edicion
        fields = ["id", "nombre", "anio", "fecha_inicio", "fecha_fin", "estado"]

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

    class Meta:
        model = Categoria
        fields = ["id", "edicion", "edicion_anio", "nombre", "slug", "descripcion", "icono", "activa", "orden"]
        extra_kwargs = {"slug": {"required": False}}

    def validate(self, datos):
        self.validar_slug_unico(datos)
        return datos


class OpcionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Opcion
        fields = ["id", "votacion", "nombre", "descripcion", "imagen", "enlace_multimedia", "orden", "activa"]

    def validate_enlace_multimedia(self, valor):
        return validar_enlace_multimedia(valor)


class OpcionPublicaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Opcion
        fields = ["id", "nombre", "descripcion", "imagen", "enlace_multimedia", "orden"]


class OpcionListadoPublicoSerializer(OpcionPublicaSerializer):
    class Meta(OpcionPublicaSerializer.Meta):
        fields = ["id", "votacion"] + OpcionPublicaSerializer.Meta.fields[1:]


class VotacionSerializer(SlugOpcionalMixin, serializers.ModelSerializer):
    campo_ambito = "categoria"
    estado = serializers.CharField(read_only=True)
    categoria_slug = serializers.CharField(source="categoria.slug", read_only=True)
    edicion_anio = serializers.IntegerField(source="categoria.edicion.anio", read_only=True)

    class Meta:
        model = Votacion
        fields = [
            "id", "categoria", "categoria_slug", "edicion_anio", "titulo", "slug", "descripcion", "imagen", "fecha_apertura", "fecha_cierre",
            "votos_por_usuario", "visibilidad_resultados", "estado", "publicada", "cerrada_manualmente",
            "resultados_publicados", "creada_en", "actualizada_en",
        ]
        read_only_fields = ["publicada", "cerrada_manualmente", "resultados_publicados", "creada_en", "actualizada_en"]
        extra_kwargs = {"slug": {"required": False}}

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

    class Meta:
        model = Votacion
        fields = [
            "id", "categoria", "categoria_nombre", "categoria_slug", "edicion_anio", "titulo", "slug", "descripcion", "imagen", "fecha_apertura",
            "fecha_cierre", "votos_por_usuario", "visibilidad_resultados", "estado",
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
