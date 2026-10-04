import re

from rest_framework import serializers

from ..comun.campos import RutaArchivoField, RutaImagenField, validar_enlace, validar_imagen, validar_pdf
from .models import BannerInicio, ConfiguracionSitio, RedSocial, Revista


class BannerInicioSerializer(serializers.ModelSerializer):
    imagen = RutaImagenField()
    edicion_anio = serializers.IntegerField(source="edicion.anio", read_only=True)

    class Meta:
        model = BannerInicio
        fields = ["id", "edicion", "edicion_anio", "titulo", "subtitulo", "imagen", "texto_alternativo", "texto_boton", "enlace_boton", "orden", "activo"]

    def validate_imagen(self, archivo):
        return validar_imagen(archivo)

    def validate_enlace_boton(self, valor):
        return validar_enlace(valor)


class RevistaSerializer(serializers.ModelSerializer):
    archivo = RutaArchivoField()

    class Meta:
        model = Revista
        fields = ["id", "titulo", "descripcion", "archivo", "orden", "activa", "publicada_en"]
        read_only_fields = ["publicada_en"]

    def validate_archivo(self, archivo):
        return validar_pdf(archivo)


class ConfiguracionSitioSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfiguracionSitio
        fields = ["nombre_organizacion", "telefono", "direccion", "correo", "texto_pie", "modo_banner", "dias_visible_cerradas", "mostrar_total_votos", "pedir_documento", "marca"]

    # Valores permitidos del tema (deben coincidir con app/web/src/data/marca.js)
    TOKENS_COLOR = {
        "--flv-rojo", "--flv-negro", "--flv-dorado", "--flv-dorado-claro", "--flv-crema", "--flv-ocre", "--flv-carbon",
        "--flv-gris-texto", "--flv-gris-borde", "--flv-fondo", "--flv-blanco", "--flv-rojo-hover", "--flv-dorado-texto",
        "--flv-rojo-sobre-oscuro", "--flv-estado-abierta", "--flv-estado-programada", "--flv-estado-cerrada",
    }
    OPCIONES_BOTON = {
        "estilo": {"relleno", "contorno", "suave", "degradado", "relieve", "texto"},
        "forma": {"recta", "suave", "redondeada", "pildora"},
        "peso": {"500", "600", "700", "800"},
    }
    OPCIONES_ALERTA = {
        "estilo": {"clasico", "lateral", "solido", "contorno", "tarjeta", "minimo"},
        "forma": {"recta", "suave", "redondeada", "pildora"},
    }
    HEX = re.compile(r"^#[0-9a-fA-F]{6}$")

    def validate_marca(self, marca):
        if not isinstance(marca, dict) or set(marca) - {"colores", "botones", "alertas"}:
            raise serializers.ValidationError("La marca solo admite «colores», «botones» y «alertas».")
        colores = marca.get("colores", {})
        if not isinstance(colores, dict):
            raise serializers.ValidationError("«colores» debe ser un objeto.")
        for token, valor in colores.items():
            if token not in self.TOKENS_COLOR or not isinstance(valor, str) or not self.HEX.match(valor):
                raise serializers.ValidationError(f"Color no válido: {token}.")
        botones = marca.get("botones", {})
        if not isinstance(botones, dict) or set(botones) - {"primario", "secundario"}:
            raise serializers.ValidationError("«botones» solo admite «primario» y «secundario».")
        for rol, boton in botones.items():
            if not isinstance(boton, dict):
                raise serializers.ValidationError(f"El botón {rol} debe ser un objeto.")
            for campo, valor in boton.items():
                if campo in self.OPCIONES_BOTON:
                    valido = valor in self.OPCIONES_BOTON[campo]
                elif campo in ("color", "colorTexto"):
                    valido = valor == "" or (isinstance(valor, str) and bool(self.HEX.match(valor)))
                elif campo == "mayusculas":
                    valido = isinstance(valor, bool)
                else:
                    valido = False
                if not valido:
                    raise serializers.ValidationError(f"Valor no válido en el botón {rol}: {campo}.")
        alertas = marca.get("alertas", {})
        if not isinstance(alertas, dict):
            raise serializers.ValidationError("«alertas» debe ser un objeto.")
        for campo, valor in alertas.items():
            if valor not in self.OPCIONES_ALERTA.get(campo, ()):
                raise serializers.ValidationError(f"Valor no válido en las alertas: {campo}.")
        return marca


class RedSocialSerializer(serializers.ModelSerializer):
    class Meta:
        model = RedSocial
        fields = ["id", "nombre", "url", "icono", "orden", "activa"]


class SitioSerializer(serializers.Serializer):
    configuracion = ConfiguracionSitioSerializer()
    redes = RedSocialSerializer(many=True)
    banners = BannerInicioSerializer(many=True)
    revistas = RevistaSerializer(many=True)
    total_votos = serializers.IntegerField(allow_null=True, help_text="Total de votos de la edición activa; nulo si no se muestra al público.")

