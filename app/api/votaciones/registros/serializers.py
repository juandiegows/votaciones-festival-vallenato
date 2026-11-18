from rest_framework import serializers

from .models import RegistroSistema


class RegistroSistemaSerializer(serializers.ModelSerializer):
    usuario = serializers.StringRelatedField()
    ubicacion = serializers.CharField(read_only=True, help_text="archivo:línea (función) donde ocurrió el fallo.")

    class Meta:
        model = RegistroSistema
        fields = [
            "id", "fecha_hora", "nivel", "fuente", "origen", "mensaje", "excepcion", "ubicacion", "archivo", "linea",
            "funcion", "traza", "metodo", "ruta", "estado_http", "id_solicitud", "usuario", "ip", "navegador", "detalle",
        ]
        read_only_fields = fields


class ErrorClienteSerializer(serializers.Serializer):
    """Error de JavaScript que reporta la web (window.onerror, promesa rechazada o ErrorBoundary de React)."""

    mensaje = serializers.CharField(max_length=2000)
    tipo = serializers.CharField(max_length=120, required=False, allow_blank=True, help_text="Error, TypeError…")
    traza = serializers.CharField(max_length=20000, required=False, allow_blank=True, help_text="error.stack")
    componentes = serializers.CharField(max_length=10000, required=False, allow_blank=True,
                                        help_text="componentStack de React (ErrorBoundary).")
    archivo = serializers.CharField(max_length=500, required=False, allow_blank=True)
    linea = serializers.IntegerField(required=False, min_value=0, allow_null=True)
    columna = serializers.IntegerField(required=False, min_value=0, allow_null=True)
    url = serializers.CharField(max_length=500, required=False, allow_blank=True, help_text="Página donde ocurrió.")
    version = serializers.CharField(max_length=40, required=False, allow_blank=True)
