from rest_framework import serializers

from .models import RegistroAuditoria


class RegistroAuditoriaSerializer(serializers.ModelSerializer):
    usuario = serializers.StringRelatedField()

    class Meta:
        model = RegistroAuditoria
        fields = ["id", "usuario", "accion", "entidad", "entidad_id", "detalle", "fecha_hora", "ip"]
        read_only_fields = fields
