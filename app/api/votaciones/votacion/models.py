"""Jerarquía del dominio: Edición → Categoría → Votación → Opción → Voto."""

from django.conf import settings
from django.db import models
from django.db.models import F, Q
from django.utils import timezone

from ..comun.consultas import slug_unico
from ..comun.models import ModeloTrazable


class Edicion(ModeloTrazable):
    class Estado(models.TextChoices):
        ACTIVA = "activa", "Activa"
        CERRADA = "cerrada", "Cerrada"

    class PresentacionCategorias(models.TextChoices):
        TARJETAS = "tarjetas", "Tarjetas"
        LISTA = "lista", "Lista"
        MOSAICO = "mosaico", "Mosaico"
        COMPACTA = "compacta", "Compacta"
        DESTACADA = "destacada", "Destacada"

    nombre = models.CharField(max_length=150)
    anio = models.PositiveSmallIntegerField("año", unique=True)
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField()
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.ACTIVA)
    presentacion_categorias = models.CharField(
        max_length=15, choices=PresentacionCategorias.choices, default=PresentacionCategorias.TARJETAS,
        help_text="Cómo se muestran las categorías de la edición al público.",
    )
    # Visibilidad de resultados de todas las votaciones de la edición (salvo las que la personalizan)
    visibilidad_resultados = models.CharField(
        max_length=15, choices=[("tiempo_real", "En tiempo real"), ("al_cierre", "Al cierre"), ("no_publicar", "No publicar")],
        default="al_cierre", help_text="Cuándo ve el público los resultados de las votaciones de la edición.",
    )
    # Límite de votos por usuario de todas las votaciones de la edición (salvo las que lo personalizan)
    votos_por_usuario = models.PositiveSmallIntegerField(default=1, help_text="Votos por usuario en cada votación de la edición.")
    # Interruptor de emergencia: mientras esté activo nadie puede votar en la edición
    votaciones_pausadas = models.BooleanField(default=False, help_text="Suspende temporalmente la recepción de votos de la edición.")

    class Meta:
        db_table = "edicion"
        ordering = ["-anio"]
        verbose_name = "edición"
        verbose_name_plural = "ediciones"
        constraints = [
            models.CheckConstraint(
                condition=Q(fecha_fin__gte=F("fecha_inicio")), name="edicion_fechas_validas"
            ),
        ]

    def __str__(self):
        return self.nombre


class Categoria(ModeloTrazable):
    edicion = models.ForeignKey(Edicion, on_delete=models.PROTECT, related_name="categorias")
    nombre = models.CharField(max_length=120)
    slug = models.SlugField(
        max_length=120, blank=True, help_text="Identificador para la URL pública; se genera desde el nombre si se deja vacío."
    )
    descripcion = models.TextField(blank=True)
    icono = models.CharField(max_length=60, blank=True)
    icono_imagen = models.ImageField(
        upload_to="iconos/", blank=True, help_text="Ícono propio subido desde el equipo; reemplaza al ícono de la lista."
    )
    activa = models.BooleanField(default=True)
    orden = models.PositiveSmallIntegerField(default=0)
    # RN-04: marcado (regla de la Entrega 3), un voto en toda la categoría aunque tenga varias votaciones (subeventos);
    # desmarcado, un voto en cada votación de la categoría
    voto_unico = models.BooleanField(
        "un solo voto en toda la categoría", default=True,
        help_text="Marcado: cada persona vota una sola vez en la categoría, aunque tenga varias votaciones. "
                  "Desmarcado: puede votar una vez en cada votación. No se puede cambiar cuando la categoría ya tiene votos.",
    )

    class Meta:
        db_table = "categoria"
        ordering = ["edicion", "orden", "nombre"]
        verbose_name = "categoría"
        verbose_name_plural = "categorías"
        constraints = [
            models.UniqueConstraint(fields=["edicion", "nombre"], name="categoria_nombre_unico_por_edicion"),
            models.UniqueConstraint(fields=["edicion", "slug"], name="categoria_slug_unico_por_edicion"),
        ]

    def __str__(self):
        return self.nombre

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slug_unico(Categoria.objects.filter(edicion_id=self.edicion_id), self.nombre, 120, self.pk)
        super().save(*args, **kwargs)


class Votacion(ModeloTrazable):
    class Estado(models.TextChoices):
        BORRADOR = "borrador", "Borrador"
        PROGRAMADA = "programada", "Programada"
        ABIERTA = "abierta", "Abierta"
        CERRADA = "cerrada", "Cerrada"

    class Visibilidad(models.TextChoices):
        TIEMPO_REAL = "tiempo_real", "En tiempo real"
        AL_CIERRE = "al_cierre", "Al cierre"
        NO_PUBLICAR = "no_publicar", "No publicar"

    class PresentacionOpciones(models.TextChoices):
        TARJETAS = "tarjetas", "Tarjetas"
        LISTA = "lista", "Lista"
        MOSAICO = "mosaico", "Mosaico"
        COMPACTA = "compacta", "Compacta"
        REPRODUCTOR = "reproductor", "Reproductor"
        COLORES = "colores", "Colores"
        RESPUESTAS = "respuestas", "Respuestas"
        DUELO = "duelo", "Duelo"

    categoria = models.ForeignKey(Categoria, on_delete=models.PROTECT, related_name="votaciones")
    titulo = models.CharField(max_length=150)
    slug = models.SlugField(
        max_length=150, blank=True, help_text="Identificador para la URL pública; se genera desde el título si se deja vacío."
    )
    descripcion = models.TextField(blank=True)
    imagen = models.URLField(blank=True)
    icono_imagen = models.ImageField(
        upload_to="iconos/", blank=True, help_text="Ícono propio subido desde el equipo; reemplaza al ícono de la lista."
    )
    presentacion_opciones = models.CharField(
        max_length=15, choices=PresentacionOpciones.choices, default=PresentacionOpciones.TARJETAS,
        help_text="Cómo se muestran las opciones de la votación al público.",
    )
    fecha_apertura = models.DateTimeField()
    fecha_cierre = models.DateTimeField()
    votos_por_usuario = models.PositiveSmallIntegerField(default=1)
    visibilidad_resultados = models.CharField(
        max_length=15, choices=Visibilidad.choices, default=Visibilidad.AL_CIERRE
    )
    # Falso: la votación hereda la visibilidad de resultados de su edición; verdadero: usa la suya
    personalizar_resultados = models.BooleanField(
        default=False, help_text="Usar la visibilidad de resultados propia en lugar de la de la edición."
    )
    # Falso: hereda el límite de votos de la edición; verdadero: usa votos_por_usuario
    personalizar_votos = models.BooleanField(default=False, help_text="Usar el límite de votos propio en lugar del de la edición.")
    publicada = models.BooleanField(default=False)
    cerrada_manualmente = models.BooleanField(default=False)
    resultados_publicados = models.BooleanField(default=False)

    class Meta:
        db_table = "votacion"
        ordering = ["fecha_apertura"]
        verbose_name = "votación"
        verbose_name_plural = "votaciones"
        constraints = [
            models.CheckConstraint(
                condition=Q(fecha_cierre__gt=F("fecha_apertura")), name="votacion_cierre_posterior_apertura"
            ),
            models.CheckConstraint(condition=Q(votos_por_usuario__gte=1), name="votacion_minimo_un_voto"),
            models.UniqueConstraint(fields=["categoria", "slug"], name="votacion_slug_unico_por_categoria"),
        ]

    def __str__(self):
        return self.titulo

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slug_unico(Votacion.objects.filter(categoria_id=self.categoria_id), self.titulo, 150, self.pk)
        super().save(*args, **kwargs)

    def estado_en(self, momento=None):
        momento = momento or timezone.now()
        if not self.publicada:
            return self.Estado.BORRADOR
        if self.cerrada_manualmente or momento >= self.fecha_cierre:
            return self.Estado.CERRADA
        if momento < self.fecha_apertura:
            return self.Estado.PROGRAMADA
        return self.Estado.ABIERTA

    @property
    def estado(self):
        return self.estado_en()

    @property
    def votos_por_usuario_efectivo(self):
        """RN-04 (Entrega 3): un solo voto por categoría y edición. votos_por_usuario queda solo por compatibilidad."""
        return 1

    @property
    def pausada(self):
        return self.categoria.edicion.votaciones_pausadas

    @property
    def visibilidad_efectiva(self):
        """Visibilidad de resultados que aplica: la propia si se personaliza; si no, la de la edición."""
        if self.personalizar_resultados:
            return self.visibilidad_resultados
        return self.categoria.edicion.visibilidad_resultados


class Opcion(ModeloTrazable):
    votacion = models.ForeignKey(Votacion, on_delete=models.PROTECT, related_name="opciones")
    nombre = models.CharField(max_length=150)
    descripcion = models.TextField(blank=True)
    imagen = models.URLField(blank=True)
    enlace_multimedia = models.CharField(
        max_length=300, blank=True, help_text="URL absoluta http(s) o ruta del sitio que empieza por «/» (p. ej. /audio/muestras/x.mp3)."
    )
    audio = models.FileField(upload_to="audios/", blank=True, help_text="Archivo de audio subido (MP3, OGG, WAV, M4A o WebM).")
    texto_audio = models.TextField(blank=True, help_text="Letra o transcripción del audio, para accesibilidad.")
    orden = models.PositiveSmallIntegerField(default=0)
    activa = models.BooleanField(default=True)

    class Meta:
        db_table = "opcion"
        ordering = ["votacion", "orden", "id"]
        verbose_name = "opción"
        verbose_name_plural = "opciones"

    def __str__(self):
        return self.nombre


class Voto(models.Model):
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="votos")
    # Edición y categoría se copian de la votación al guardar: así MySQL puede exigir la regla de unicidad (RN-04)
    edicion = models.ForeignKey(Edicion, on_delete=models.PROTECT, related_name="votos")
    categoria = models.ForeignKey(Categoria, on_delete=models.PROTECT, related_name="votos")
    votacion = models.ForeignKey(Votacion, on_delete=models.PROTECT, related_name="votos")
    # 0 si el voto cuenta para toda la categoría (voto_unico); si no, el ID de la votación. Entra en la restricción única
    ambito_votacion = models.PositiveIntegerField(default=0, editable=False)
    opcion = models.ForeignKey(Opcion, on_delete=models.PROTECT, related_name="votos")
    fecha_hora = models.DateTimeField(auto_now_add=True)
    codigo_comprobante = models.CharField(max_length=20, unique=True)
    ip = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        db_table = "voto"
        ordering = ["-fecha_hora"]
        verbose_name = "voto"
        verbose_name_plural = "votos"
        indexes = [models.Index(fields=["usuario", "votacion"], name="voto_usuario_votacion_idx")]
        constraints = [
            # RN-04: un voto por usuario, categoría y edición (o por votación si la categoría no es de voto único).
            # Es la última barrera ante dos solicitudes simultáneas: la segunda falla con IntegrityError.
            models.UniqueConstraint(
                fields=["usuario", "categoria", "edicion", "ambito_votacion"], name="voto_unico_usuario_categoria_edicion"
            ),
        ]

    def __str__(self):
        return self.codigo_comprobante

    def completar_ambito(self):
        """Toma categoría, edición y ámbito de la votación (también antes de un bulk_create, que no llama a save)."""
        categoria = self.votacion.categoria
        self.categoria_id = categoria.pk
        self.edicion_id = categoria.edicion_id
        self.ambito_votacion = 0 if categoria.voto_unico else self.votacion_id
        return self

    def save(self, *args, **kwargs):
        self.completar_ambito()
        super().save(*args, **kwargs)
