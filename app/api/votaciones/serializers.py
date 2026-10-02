from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
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

    def validate_email(self, valor):
        valor = valor.lower()
        if Usuario.objects.filter(email=valor).exists():
            raise serializers.ValidationError("Ya existe una cuenta con este correo.")
        return valor

    def validate_acepta_tratamiento_datos(self, valor):
        if not valor:
            raise serializers.ValidationError(
                "Debes aceptar la política de tratamiento de datos personales (RN-10)."
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


class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = ["id", "edicion", "nombre", "descripcion", "icono", "activa", "orden"]


class OpcionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Opcion
        fields = ["id", "votacion", "nombre", "descripcion", "imagen", "enlace_multimedia", "orden", "activa"]


class OpcionPublicaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Opcion
        fields = ["id", "nombre", "descripcion", "imagen", "enlace_multimedia", "orden"]


class VotacionSerializer(serializers.ModelSerializer):
    estado = serializers.CharField(read_only=True)

    class Meta:
        model = Votacion
        fields = [
            "id", "categoria", "titulo", "descripcion", "imagen", "fecha_apertura", "fecha_cierre",
            "votos_por_usuario", "visibilidad_resultados", "estado", "publicada", "cerrada_manualmente",
            "resultados_publicados", "creada_en", "actualizada_en",
        ]
        read_only_fields = ["publicada", "cerrada_manualmente", "resultados_publicados", "creada_en", "actualizada_en"]

    def validate(self, datos):
        apertura = datos.get("fecha_apertura", getattr(self.instance, "fecha_apertura", None))
        cierre = datos.get("fecha_cierre", getattr(self.instance, "fecha_cierre", None))
        if apertura and cierre and cierre <= apertura:
            raise serializers.ValidationError({"fecha_cierre": "Debe ser posterior a la fecha de apertura."})
        return datos


class VotacionPublicaSerializer(serializers.ModelSerializer):
    estado = serializers.CharField(read_only=True)
    categoria_nombre = serializers.CharField(source="categoria.nombre", read_only=True)

    class Meta:
        model = Votacion
        fields = [
            "id", "categoria", "categoria_nombre", "titulo", "descripcion", "imagen", "fecha_apertura",
            "fecha_cierre", "votos_por_usuario", "visibilidad_resultados", "estado",
        ]


class VotacionDetalleSerializer(VotacionPublicaSerializer):
    opciones = serializers.SerializerMethodField()
    mis_votos = serializers.SerializerMethodField()

    class Meta(VotacionPublicaSerializer.Meta):
        fields = VotacionPublicaSerializer.Meta.fields + ["opciones", "mis_votos"]

    def get_opciones(self, votacion):
        return OpcionPublicaSerializer(votacion.opciones.filter(activa=True), many=True).data

    def get_mis_votos(self, votacion):
        request = self.context.get("request")
        return votos_del_usuario(request.user, votacion) if request else 0


class VotarSerializer(serializers.Serializer):
    opcion = serializers.IntegerField(min_value=1)


class VotoSerializer(serializers.ModelSerializer):
    votacion_titulo = serializers.CharField(source="votacion.titulo", read_only=True)
    opcion_nombre = serializers.CharField(source="opcion.nombre", read_only=True)

    class Meta:
        model = Voto
        fields = ["id", "votacion", "votacion_titulo", "opcion", "opcion_nombre", "fecha_hora", "codigo_comprobante"]
        read_only_fields = fields


class RegistroAuditoriaSerializer(serializers.ModelSerializer):
    usuario = serializers.StringRelatedField()

    class Meta:
        model = RegistroAuditoria
        fields = ["id", "usuario", "accion", "entidad", "entidad_id", "detalle", "fecha_hora", "ip"]
        read_only_fields = fields
