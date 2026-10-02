from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.db.models import F, Q
from django.utils import timezone
from django.utils.text import slugify


def slug_unico(consulta, texto, max_length, excluir_pk=None):
    """Slug sin tildes a partir de `texto`, único dentro de `consulta` (agrega -2, -3… si se repite)."""
    base = (slugify(texto) or "item")[:max_length].strip("-")
    if excluir_pk is not None:
        consulta = consulta.exclude(pk=excluir_pk)
    candidato, n = base, 2
    while consulta.filter(slug=candidato).exists():
        sufijo = f"-{n}"
        candidato = f"{base[: max_length - len(sufijo)]}{sufijo}"
        n += 1
    return candidato


class UsuarioManager(BaseUserManager):
    use_in_migrations = True

    def _crear(self, email, password, **extra):
        if not email:
            raise ValueError("El correo es obligatorio")
        usuario = self.model(email=self.normalize_email(email).lower(), **extra)
        usuario.set_password(password)
        usuario.save(using=self._db)
        return usuario

    def create_user(self, email, password=None, **extra):
        extra.setdefault("rol", Usuario.Rol.VOTANTE)
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        return self._crear(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("rol", Usuario.Rol.ADMINISTRADOR)
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("acepta_tratamiento_datos", True)
        return self._crear(email, password, **extra)


class Usuario(AbstractUser):
    class Rol(models.TextChoices):
        VOTANTE = "votante", "Votante"
        ADMINISTRADOR = "administrador", "Administrador"

    username = None
    first_name = None
    last_name = None

    email = models.EmailField("correo", unique=True)
    nombres = models.CharField(max_length=100)
    apellidos = models.CharField(max_length=100)
    rol = models.CharField(max_length=20, choices=Rol.choices, default=Rol.VOTANTE)
    acepta_tratamiento_datos = models.BooleanField(default=False)
    fecha_registro = models.DateTimeField(default=timezone.now)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["nombres", "apellidos"]

    objects = UsuarioManager()

    class Meta:
        db_table = "usuario"
        verbose_name = "usuario"
        verbose_name_plural = "usuarios"

    def __str__(self):
        return f"{self.nombres} {self.apellidos} <{self.email}>"

    @property
    def es_administrador(self):
        return self.rol == self.Rol.ADMINISTRADOR


class Edicion(models.Model):
    class Estado(models.TextChoices):
        ACTIVA = "activa", "Activa"
        CERRADA = "cerrada", "Cerrada"

    nombre = models.CharField(max_length=150)
    anio = models.PositiveSmallIntegerField("año", unique=True)
    fecha_inicio = models.DateField()
    fecha_fin = models.DateField()
    estado = models.CharField(max_length=10, choices=Estado.choices, default=Estado.ACTIVA)

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


class Categoria(models.Model):
    edicion = models.ForeignKey(Edicion, on_delete=models.PROTECT, related_name="categorias")
    nombre = models.CharField(max_length=120)
    slug = models.SlugField(
        max_length=120, blank=True, help_text="Identificador para la URL pública; se genera desde el nombre si se deja vacío."
    )
    descripcion = models.TextField(blank=True)
    icono = models.CharField(max_length=60, blank=True)
    activa = models.BooleanField(default=True)
    orden = models.PositiveSmallIntegerField(default=0)

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


class Votacion(models.Model):
    class Estado(models.TextChoices):
        BORRADOR = "borrador", "Borrador"
        PROGRAMADA = "programada", "Programada"
        ABIERTA = "abierta", "Abierta"
        CERRADA = "cerrada", "Cerrada"

    class Visibilidad(models.TextChoices):
        TIEMPO_REAL = "tiempo_real", "En tiempo real"
        AL_CIERRE = "al_cierre", "Al cierre"
        NO_PUBLICAR = "no_publicar", "No publicar"

    categoria = models.ForeignKey(Categoria, on_delete=models.PROTECT, related_name="votaciones")
    titulo = models.CharField(max_length=150)
    slug = models.SlugField(
        max_length=150, blank=True, help_text="Identificador para la URL pública; se genera desde el título si se deja vacío."
    )
    descripcion = models.TextField(blank=True)
    imagen = models.URLField(blank=True)
    fecha_apertura = models.DateTimeField()
    fecha_cierre = models.DateTimeField()
    votos_por_usuario = models.PositiveSmallIntegerField(default=1)
    visibilidad_resultados = models.CharField(
        max_length=15, choices=Visibilidad.choices, default=Visibilidad.AL_CIERRE
    )
    publicada = models.BooleanField(default=False)
    cerrada_manualmente = models.BooleanField(default=False)
    resultados_publicados = models.BooleanField(default=False)
    creada_en = models.DateTimeField(auto_now_add=True)
    actualizada_en = models.DateTimeField(auto_now=True)

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


class Opcion(models.Model):
    votacion = models.ForeignKey(Votacion, on_delete=models.PROTECT, related_name="opciones")
    nombre = models.CharField(max_length=150)
    descripcion = models.TextField(blank=True)
    imagen = models.URLField(blank=True)
    enlace_multimedia = models.CharField(
        max_length=300, blank=True, help_text="URL absoluta http(s) o ruta del sitio que empieza por «/» (p. ej. /audio/muestras/x.mp3)."
    )
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
    usuario = models.ForeignKey(Usuario, on_delete=models.PROTECT, related_name="votos")
    votacion = models.ForeignKey(Votacion, on_delete=models.PROTECT, related_name="votos")
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

    def __str__(self):
        return self.codigo_comprobante


class RegistroAuditoria(models.Model):
    usuario = models.ForeignKey(
        Usuario, on_delete=models.SET_NULL, null=True, blank=True, related_name="registros_auditoria"
    )
    accion = models.CharField(max_length=40)
    entidad = models.CharField(max_length=40)
    entidad_id = models.CharField(max_length=40, blank=True)
    detalle = models.JSONField(default=dict, blank=True)
    fecha_hora = models.DateTimeField(auto_now_add=True)
    ip = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        db_table = "registro_auditoria"
        ordering = ["-fecha_hora"]
        verbose_name = "registro de auditoría"
        verbose_name_plural = "registros de auditoría"

    def __str__(self):
        return f"{self.accion} {self.entidad} {self.entidad_id}"
