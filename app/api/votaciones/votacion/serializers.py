from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from ..comun.campos import (
    RutaArchivoField, RutaImagenField, SlugOpcionalMixin, validar_audio, validar_enlace, validar_icono,
)
from .models import Categoria, Edicion, Opcion, Votacion, Voto
from .selectores import votos_del_usuario


class EdicionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Edicion
        fields = ["id", "nombre", "anio", "fecha_inicio", "fecha_fin", "estado", "presentacion_categorias", "visibilidad_resultados",
                  "votos_por_usuario", "votaciones_pausadas"]

    def validate(self, datos):
        inicio = datos.get("fecha_inicio", getattr(self.instance, "fecha_inicio", None))
        fin = datos.get("fecha_fin", getattr(self.instance, "fecha_fin", None))
        if inicio and fin and fin < inicio:
            raise serializers.ValidationError({"fecha_fin": "Debe ser igual o posterior a la fecha de inicio."})
        return datos


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
        # Una edición cerrada no recibe categorías nuevas (ni categorías movidas desde otra edición)
        edicion = datos.get("edicion")
        if edicion and edicion.estado == Edicion.Estado.CERRADA and getattr(self.instance, "edicion_id", None) != edicion.pk:
            raise serializers.ValidationError({"edicion": "La edición está cerrada: no se pueden agregar categorías."})
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
        return validar_enlace(valor)

    def validate_audio(self, archivo):
        return validar_audio(archivo)

    def validate(self, datos):
        # Una votación cerrada ya no admite opciones nuevas
        votacion = datos.get("votacion")
        if self.instance is None and votacion and votacion.estado == Votacion.Estado.CERRADA:
            raise serializers.ValidationError({"votacion": "La votación está cerrada: no se pueden agregar opciones."})
        return datos


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
    visibilidad_efectiva = serializers.CharField(read_only=True)
    votos_efectivos = serializers.IntegerField(source="votos_por_usuario_efectivo", read_only=True)
    pausada = serializers.BooleanField(read_only=True)

    class Meta:
        model = Votacion
        fields = [
            "id", "categoria", "categoria_slug", "edicion_anio", "titulo", "slug", "descripcion", "imagen", "icono_imagen",
            "presentacion_opciones", "fecha_apertura", "fecha_cierre",
            "votos_por_usuario", "personalizar_votos", "votos_efectivos", "pausada",
            "visibilidad_resultados", "personalizar_resultados", "visibilidad_efectiva",
            "estado", "publicada", "cerrada_manualmente",
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
    visibilidad_resultados = serializers.CharField(source="visibilidad_efectiva", read_only=True)
    votos_por_usuario = serializers.IntegerField(source="votos_por_usuario_efectivo", read_only=True)
    pausada = serializers.BooleanField(read_only=True)

    class Meta:
        model = Votacion
        fields = [
            "id", "categoria", "categoria_nombre", "categoria_slug", "edicion_anio", "titulo", "slug", "descripcion", "imagen",
            "icono_imagen", "presentacion_opciones", "fecha_apertura", "fecha_cierre", "votos_por_usuario",
            "visibilidad_resultados", "estado", "pausada",
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


class PublicarResultadosSerializer(serializers.Serializer):
    publicar = serializers.BooleanField(default=True)


# Respuestas de los reportes (votacion/reportes.py)


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
