from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from . import selectores
from .documentos import error_formato_documento, normalizar_documento
from .models import Usuario


class UsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = [
            "id", "email", "nombres", "apellidos", "rol", "fecha_registro", "tipo_documento", "numero_documento",
            "correo_verificado",
        ]
        read_only_fields = fields


class UsuarioAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Usuario
        fields = [
            "id", "email", "nombres", "apellidos", "rol", "is_active", "fecha_registro", "tipo_documento",
            "numero_documento", "correo_verificado",
        ]
        read_only_fields = fields


# Solo valida; la cuenta la crea servicios.registrar_votante
class RegistroSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    tipo_documento = serializers.ChoiceField(choices=Usuario.TipoDocumento.choices)
    numero_documento = serializers.CharField(max_length=30)

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
        datos["numero_documento"] = numero = normalizar_documento(datos["numero_documento"])
        error = error_formato_documento(datos["tipo_documento"], numero)
        if error:
            raise serializers.ValidationError({"numero_documento": error})
        if selectores.documento_registrado(datos["tipo_documento"], numero):
            raise serializers.ValidationError({"numero_documento": "Ya existe una cuenta con este documento."})
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
