from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from ..comun.models import ModeloTrazable
from ..votacion.models import Edicion, Votacion


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
    # Textos de identificación del proyecto: vacíos, no se muestran (p. ej. cuando el sitio deje de ser un prototipo)
    aviso_superior = models.CharField(
        "aviso del pie de página", max_length=250, blank=True,
        default="Prototipo académico – Areandina · Desarrollo Web 2026 · Datos ilustrativos de demostración",
        help_text="Franja destacada encima del pie de página. Vacío = no se muestra.",
    )
    subtitulo_logo = models.CharField(
        "subtítulo del logo", max_length=60, blank=True, default="Prototipo académico",
        help_text="Texto pequeño bajo el nombre del sitio en el menú. Vacío = no se muestra.",
    )
    texto_acerca = models.CharField(
        "texto «Acerca de»", max_length=250, blank=True,
        default="Proyecto académico de Desarrollo Web · Fundación Universitaria del Área Andina",
        help_text="Línea final del pie de página. Vacío = no se muestra.",
    )
    permitir_cuentas_demo = models.BooleanField(
        "permitir el ingreso con las cuentas de demostración", default=True,
        help_text="Apagada, las cuentas que crea cargar_demo (admin@festival.test, votante@festival.test y "
                  "@demo.festival.test) no pueden iniciar sesión y el login no muestra sus credenciales.",
    )
    mostrar_equipo = models.BooleanField(
        "mostrar la página del equipo", default=True,
        help_text="Publica /equipo y sus enlaces en el menú y el pie. Apagada, la página responde 404.",
    )
    # Fijo: solo el primer banner activo; carrusel: todos los activos rotando
    modo_banner = models.CharField(max_length=10, choices=ModoBanner.choices, default=ModoBanner.CARRUSEL)
    # Días que una votación cerrada sigue visible en el sitio público (0 = se oculta al cerrar; vacío = siempre)
    # Muestra en el inicio el total de votos de la edición activa
    mostrar_total_votos = models.BooleanField(default=False, help_text="Mostrar al público el total de votos en el inicio.")
    mostrar_participantes = models.BooleanField(
        "mostrar quién participó", default=True,
        help_text="Mostrar a la administración la lista de participantes de cada votación (nunca por qué opción votaron).",
    )
    umbral_participacion = models.PositiveSmallIntegerField(
        "mínimo de votantes para mostrar participantes", default=10, validators=[MinValueValidator(2)],
        help_text="Con menos votantes la lista queda oculta, aun con la votación cerrada. Abierta, se muestra en bloques de este tamaño.",
    )
    mostrar_swagger = models.BooleanField(
        "mostrar la documentación de la API", default=True,
        help_text="Publicar Swagger (/api/docs/), ReDoc (/api/redoc/) y el esquema (/api/esquema/). Apagado responden 404.",
    )
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
    # Valores con los que se crea cada edición, categoría o votación nueva (después se cambian en cada una)
    defecto_presentacion_categorias = models.CharField(
        "presentación de las categorías", max_length=15, choices=Edicion.PresentacionCategorias.choices,
        default=Edicion.PresentacionCategorias.TARJETAS, help_text="Edición nueva: cómo ve el público sus categorías.",
    )
    defecto_visibilidad_resultados = models.CharField(
        "cuándo se publican los resultados", max_length=15, choices=Votacion.Visibilidad.choices,
        default=Votacion.Visibilidad.AL_CIERRE, help_text="Edición nueva: cuándo ve el público los resultados de sus votaciones.",
    )
    defecto_voto_unico = models.BooleanField(
        "un solo voto en toda la categoría", default=True,
        help_text="Categoría nueva: encendido, un voto en toda la categoría; apagado, un voto en cada votación.",
    )
    defecto_categoria_activa = models.BooleanField(
        "categoría visible al crearla", default=True, help_text="Categoría nueva: se muestra al público desde que se crea.",
    )
    defecto_presentacion_opciones = models.CharField(
        "presentación de las opciones", max_length=15, choices=Votacion.PresentacionOpciones.choices,
        default=Votacion.PresentacionOpciones.TARJETAS, help_text="Votación nueva: cómo ve el público sus opciones.",
    )
    defecto_dias_votacion = models.PositiveSmallIntegerField(
        "días que dura una votación", default=7, validators=[MinValueValidator(1), MaxValueValidator(365)],
        help_text="Votación nueva: días entre la apertura y el cierre que se proponen al crearla.",
    )

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
