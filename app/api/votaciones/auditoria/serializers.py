from rest_framework import serializers

from .models import RegistroAuditoria


class RegistroAuditoriaSerializer(serializers.ModelSerializer):
    usuario = serializers.StringRelatedField()

    class Meta:
        model = RegistroAuditoria
        fields = ["id", "usuario", "accion", "entidad", "entidad_id", "detalle", "fecha_hora", "ip"]
        read_only_fields = fields


class RegistroAutoriaSerializer(serializers.Serializer):
    entidad = serializers.CharField(help_text="edicion, categoria, votacion, opcion, banner, revista, red_social, configuracion")
    entidad_id = serializers.IntegerField()
    nombre = serializers.CharField()
    creado_en = serializers.DateTimeField()
    creado_por = serializers.CharField(allow_null=True, help_text="Nulo si lo creó un proceso sin usuario (datos de demostración).")
    actualizado_en = serializers.DateTimeField()
    actualizado_por = serializers.CharField(allow_null=True)


class AutoriaSerializer(serializers.Serializer):
    edicion_id = serializers.IntegerField()
    edicion = serializers.CharField()
    registros = RegistroAutoriaSerializer(many=True)
