"""Campos y validadores de serializers reutilizados por varios módulos (archivos subidos, slugs y enlaces)."""

import re

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator
from rest_framework import serializers

TAMANO_MAXIMO_IMAGEN = 3 * 1024 * 1024
TAMANO_MAXIMO_ICONO = 1 * 1024 * 1024
TAMANO_MAXIMO_AUDIO = 10 * 1024 * 1024
TAMANO_MAXIMO_PDF = 50 * 1024 * 1024
FORMATOS_IMAGEN = {"JPEG", "PNG", "WEBP"}
EXTENSIONES_AUDIO = (".mp3", ".ogg", ".wav", ".m4a", ".webm")
PATRON_SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


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


def validar_imagen(archivo, tamano_maximo=TAMANO_MAXIMO_IMAGEN, nombre="La imagen"):
    if not archivo:
        return archivo
    if archivo.size > tamano_maximo:
        raise serializers.ValidationError(f"{nombre} supera el tamaño máximo de {tamano_maximo // (1024 * 1024)} MB.")
    formato = getattr(getattr(archivo, "image", None), "format", None)
    if formato not in FORMATOS_IMAGEN:
        raise serializers.ValidationError("Formato no permitido: usa una imagen JPG, PNG o WebP.")
    return archivo


def validar_icono(archivo):
    return validar_imagen(archivo, TAMANO_MAXIMO_ICONO, "El ícono")


def validar_audio(archivo):
    if not archivo:
        return archivo
    if archivo.size > TAMANO_MAXIMO_AUDIO:
        raise serializers.ValidationError("El audio supera el tamaño máximo de 10 MB.")
    tipo = getattr(archivo, "content_type", "") or ""
    if not archivo.name.lower().endswith(EXTENSIONES_AUDIO) or (tipo and not tipo.startswith(("audio/", "video/webm"))):
        raise serializers.ValidationError("Formato no permitido: usa un archivo MP3, OGG, WAV, M4A o WebM.")
    return archivo


def validar_pdf(archivo):
    if archivo.size > TAMANO_MAXIMO_PDF:
        raise serializers.ValidationError("El PDF supera el tamaño máximo de 50 MB.")
    # Se revisa la firma del archivo, no solo la extensión
    inicio = archivo.read(5)
    archivo.seek(0)
    if not archivo.name.lower().endswith(".pdf") or inicio != b"%PDF-":
        raise serializers.ValidationError("Formato no permitido: sube la revista en PDF.")
    return archivo


def validar_slug(valor):
    valor = (valor or "").strip().lower()
    if valor and not PATRON_SLUG.match(valor):
        raise serializers.ValidationError(
            "Usa solo letras minúsculas sin tildes, números y guiones (p. ej. «cancion-favorita»)."
        )
    return valor


def validar_enlace(valor):
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
