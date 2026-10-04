from django.db import models

from ..comun.models import ModeloTrazable
from ..votacion.models import Edicion


class BannerInicio(ModeloTrazable):
    # El inicio solo muestra los banners de la edición activa
    edicion = models.ForeignKey(Edicion, on_delete=models.PROTECT, related_name="banners")
    # Título y subtítulo opcionales: sin textos la imagen se muestra completa, sin capa oscura encima
    titulo = models.CharField(max_length=120, blank=True)
    subtitulo = models.CharField(max_length=250, blank=True)
    imagen = models.ImageField(upload_to="banners/")
    texto_alternativo = models.CharField(max_length=200, help_text="Descripción de la imagen para lectores de pantalla.")
    texto_boton = models.CharField(max_length=40, blank=True)
    enlace_boton = models.CharField(max_length=300, blank=True, help_text="Ruta del sitio (/2027) o URL http(s).")
    orden = models.PositiveSmallIntegerField(default=0)
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = "banner_inicio"
        ordering = ["edicion", "orden", "id"]
        verbose_name = "banner de inicio"
        verbose_name_plural = "banners de inicio"

    def __str__(self):
        return self.titulo or self.texto_alternativo


class Revista(ModeloTrazable):
    """Revista institucional en PDF: el inicio la muestra como un libro que se hojea."""

    titulo = models.CharField(max_length=150)
    descripcion = models.TextField(blank=True)
    archivo = models.FileField(upload_to="revistas/", help_text="Revista en PDF (máximo 50 MB).")
    orden = models.PositiveSmallIntegerField(default=0)
    activa = models.BooleanField(default=True)
    publicada_en = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "revista"
        ordering = ["orden", "-publicada_en"]
        verbose_name = "revista"
        verbose_name_plural = "revistas"

    def __str__(self):
        return self.titulo


class ConfiguracionSitio(ModeloTrazable):
    """Datos de contacto del pie de página y modo del banner del inicio (un único registro, pk=1)."""

    class ModoBanner(models.TextChoices):
        FIJO = "fijo", "Banner fijo"
        CARRUSEL = "carrusel", "Carrusel"

    nombre_organizacion = models.CharField(max_length=150, default="Fundación Festival de la Leyenda Vallenata")
    telefono = models.CharField(max_length=40, default="(+57) 315-746 3143")
    direccion = models.CharField(max_length=200, default="Carrera 19 No. 6N-39, Valledupar, Colombia")
    correo = models.EmailField(default="presidencia@festivalvallenato.com")
    texto_pie = models.TextField(
        blank=True,
        default="Diseño académico original: no representa la marca oficial del Festival ni de la Fundación.",
    )
    # Fijo: solo el primer banner activo; carrusel: todos los activos rotando
    modo_banner = models.CharField(max_length=10, choices=ModoBanner.choices, default=ModoBanner.CARRUSEL)
    # Días que una votación cerrada sigue visible en el sitio público (0 = se oculta al cerrar; vacío = siempre)
    # Muestra en el inicio el total de votos de la edición activa
    mostrar_total_votos = models.BooleanField(default=False, help_text="Mostrar al público el total de votos en el inicio.")
    # Pendiente de validación con la Fundación (P-01): por defecto el registro es solo con correo confirmado
    pedir_documento = models.BooleanField(
        default=False, help_text="Pedir tipo y número de documento al registrarse (cada documento, una sola cuenta)."
    )
    dias_visible_cerradas = models.PositiveSmallIntegerField(
        default=7, null=True, blank=True,
        help_text="Días que una votación cerrada sigue visible en el sitio público (0 = se oculta al cerrar; vacío = siempre visible).",
    )
    # Tema editable desde /panel/marca: {"colores": {token: hex}, "botones": {"primario": {...}, "secundario": {...}}}.
    # Solo guarda lo que difiere de la marca base (docs/BRANDING.md); vacío = marca base.
    marca = models.JSONField(default=dict, blank=True, help_text="Colores y estilos de botón personalizados del sitio.")

    class Meta:
        db_table = "configuracion_sitio"
        verbose_name = "configuración del sitio"
        verbose_name_plural = "configuración del sitio"

    def __str__(self):
        return self.nombre_organizacion

    @classmethod
    def obtener(cls):
        return cls.objects.get_or_create(pk=1)[0]


class RedSocial(ModeloTrazable):
    class Icono(models.TextChoices):
        FACEBOOK = "facebook", "Facebook"
        TWITTER_X = "twitter-x", "X"
        INSTAGRAM = "instagram", "Instagram"
        YOUTUBE = "youtube", "YouTube"
        TIKTOK = "tiktok", "TikTok"
        WHATSAPP = "whatsapp", "WhatsApp"
        SPOTIFY = "spotify", "Spotify"
        GLOBE = "globe", "Sitio web"

    nombre = models.CharField(max_length=60)
    url = models.URLField()
    icono = models.CharField(max_length=20, choices=Icono.choices, default=Icono.GLOBE)
    orden = models.PositiveSmallIntegerField(default=0)
    activa = models.BooleanField(default=True)

    class Meta:
        db_table = "red_social"
        ordering = ["orden", "id"]
        verbose_name = "red social"
        verbose_name_plural = "redes sociales"

    def __str__(self):
        return self.nombre
