from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from . import selectores
from .documentos import error_formato_documento, normalizar_documento
from . import permisos as catalogo
from .models import Rol, Usuario


def nombre_rol(codigo):
    return Rol.objects.filter(codigo=codigo).values_list("nombre", flat=True).first() or codigo


class UsuarioSerializer(serializers.ModelSerializer):
    rol_nombre = serializers.SerializerMethodField()
    permisos = serializers.SerializerMethodField(help_text="Permisos efectivos del rol (catálogo en /api/gestion/roles/catalogo/).")

    class Meta:
        model = Usuario
        fields = [
            "id", "email", "nombres", "apellidos", "rol", "rol_nombre", "permisos", "fecha_registro", "tipo_documento",
            "numero_documento", "correo_verificado",
        ]
        read_only_fields = fields

    def get_rol_nombre(self, usuario) -> str:
        return nombre_rol(usuario.rol)

    def get_permisos(self, usuario) -> list[str]:
        return sorted(usuario.permisos)


class UsuarioAdminSerializer(serializers.ModelSerializer):
    rol_nombre = serializers.SerializerMethodField()

    class Meta:
        model = Usuario
        fields = [
            "id", "email", "nombres", "apellidos", "rol", "rol_nombre", "is_active", "fecha_registro", "tipo_documento",
            "numero_documento", "correo_verificado",
        ]
        read_only_fields = fields

    def get_rol_nombre(self, usuario) -> str:
        return self.context.get("nombres_roles", {}).get(usuario.rol) or nombre_rol(usuario.rol)


class RolSerializer(serializers.ModelSerializer):
    permisos = serializers.ListField(child=serializers.ChoiceField(choices=sorted(catalogo.TODOS)), required=False)
    usuarios = serializers.SerializerMethodField()
    fijo = serializers.BooleanField(source="es_fijo", read_only=True)

    class Meta:
        model = Rol
        fields = ["id", "codigo", "nombre", "descripcion", "permisos", "sistema", "fijo", "orden", "usuarios"]
        read_only_fields = ["id", "sistema", "fijo", "usuarios"]

    def get_usuarios(self, rol) -> int:
        return Usuario.objects.filter(rol=rol.codigo).count()

    def to_representation(self, rol):
        datos = super().to_representation(rol)
        datos["permisos"] = sorted(rol.permisos_efectivos)
        return datos

    def validate_codigo(self, valor):
        if self.instance is not None and valor != self.instance.codigo:
            raise serializers.ValidationError("El código de un rol no se cambia.")
        return valor


def validar_documento(tipo, numero):
    """Formato según el tipo y una sola cuenta por documento (el número ya viene normalizado)."""
    error = error_formato_documento(tipo, numero)
    if error:
        raise serializers.ValidationError({"numero_documento": error})
    if selectores.documento_registrado(tipo, numero):
        raise serializers.ValidationError({"numero_documento": "Ya existe una cuenta con este documento."})


class CompletarDocumentoSerializer(serializers.Serializer):
    """Para quien se registró sin documento y la administración luego empezó a pedirlo."""

    tipo_documento = serializers.ChoiceField(choices=Usuario.TipoDocumento.choices)
    numero_documento = serializers.CharField(max_length=30)

    def validate(self, datos):
        datos["numero_documento"] = normalizar_documento(datos["numero_documento"])
        validar_documento(datos["tipo_documento"], datos["numero_documento"])
        return datos


# Solo valida; la cuenta la crea servicios.registrar_votante
class RegistroSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    # Obligatorios solo si la administración activa «Pedir documento» (configuración del sitio)
    tipo_documento = serializers.ChoiceField(choices=Usuario.TipoDocumento.choices, required=False, allow_blank=True)
    numero_documento = serializers.CharField(max_length=30, required=False, allow_blank=True)

    class Meta:
        model = Usuario
        fields = ["email", "nombres", "apellidos", "tipo_documento", "numero_documento", "password", "acepta_tratamiento_datos"]
        # La unicidad del correo y del documento se valida a mano (mensajes claros, sin distinguir mayúsculas)
        extra_kwargs = {"email": {"validators": []}}
        validators = []

    def validate_email(self, valor):
        valor = valor.lower()
        if selectores.correo_registrado(valor):
            raise serializers.ValidationError("Ya existe una cuenta con este correo.")
        return valor

    def validate_acepta_tratamiento_datos(self, valor):
        if not valor:
            raise serializers.ValidationError(
                "Debes aceptar la política de tratamiento de datos personales."
            )
        return valor

    def validate(self, datos):
        from votaciones.sitio.models import ConfiguracionSitio

        tipo = datos.get("tipo_documento") or ""
        numero = normalizar_documento(datos.get("numero_documento") or "")
        if ConfiguracionSitio.obtener().pedir_documento:
            faltan = {campo: "Este campo es obligatorio." for campo, valor in (("tipo_documento", tipo), ("numero_documento", numero)) if not valor}
            if faltan:
                raise serializers.ValidationError(faltan)
        if tipo or numero:
            # Si se envía (aunque no se exija), se valida completo: tipo, formato y una cuenta por documento
            if not tipo or not numero:
                campo = "numero_documento" if tipo else "tipo_documento"
                raise serializers.ValidationError({campo: "Indica el tipo y el número de documento, o deja ambos vacíos."})
            validar_documento(tipo, numero)
        datos["tipo_documento"], datos["numero_documento"] = tipo, (numero or None)
        validate_password(datos["password"], Usuario(email=datos.get("email"), nombres=datos.get("nombres", "")))
        return datos


class ConfirmarCorreoSerializer(serializers.Serializer):
    token = serializers.CharField()


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


class TokenRespuestaSerializer(serializers.Serializer):
    token = serializers.CharField(help_text="Usar como encabezado `Authorization: Token <token>`.")
    usuario = UsuarioSerializer()
