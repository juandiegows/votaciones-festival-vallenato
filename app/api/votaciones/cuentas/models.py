from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils import timezone
from django.utils.functional import cached_property

from . import permisos as catalogo


class Rol(models.Model):
    """Conjunto de permisos que se asigna a un usuario. Los roles del sistema no se eliminan."""

    codigo = models.SlugField("código", max_length=30, unique=True)
    nombre = models.CharField(max_length=60, unique=True)
    descripcion = models.CharField("descripción", max_length=200, blank=True)
    permisos = models.JSONField(default=list, blank=True, help_text="Códigos del catálogo de permisos.")
    sistema = models.BooleanField(default=False, help_text="Rol del sistema: no se elimina ni cambia de código.")
    orden = models.PositiveSmallIntegerField(default=10)

    class Meta:
        db_table = "rol"
        ordering = ["orden", "nombre"]
        verbose_name = "rol"
        verbose_name_plural = "roles"

    def __str__(self):
        return self.nombre

    @property
    def es_fijo(self):
        """Votante y administrador: sus permisos no se editan."""
        return self.codigo in catalogo.ROLES_FIJOS

    @property
    def permisos_efectivos(self):
        if self.codigo == catalogo.ADMINISTRADOR:
            return catalogo.TODOS
        if self.codigo == catalogo.VOTANTE:
            return frozenset()
        return frozenset(self.permisos or ()) & catalogo.TODOS


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
        extra.setdefault("correo_verificado", True)
        return self._crear(email, password, **extra)


class Usuario(AbstractUser):
    class Rol(models.TextChoices):
        """Códigos de los roles del sistema; los roles creados en el panel usan su propio código (modelo Rol)."""

        VOTANTE = catalogo.VOTANTE, "Votante"
        LECTURA = catalogo.LECTURA, "Solo lectura"
        EDITOR = catalogo.EDITOR, "Lectura y escritura"
        ADMINISTRADOR = catalogo.ADMINISTRADOR, "Administrador"

    class TipoDocumento(models.TextChoices):
        CC = "CC", "Cédula de ciudadanía"
        CE = "CE", "Cédula de extranjería"
        TI = "TI", "Tarjeta de identidad"
        PA = "PA", "Pasaporte"
        PPT = "PPT", "Permiso por protección temporal"

    username = None
    first_name = None
    last_name = None

    email = models.EmailField("correo", unique=True)
    nombres = models.CharField(max_length=100)
    apellidos = models.CharField(max_length=100)
    # Código de un Rol (votante, lectura, editor, administrador o uno creado en el panel)
    rol = models.CharField(max_length=30, default=Rol.VOTANTE, db_index=True)
    acepta_tratamiento_datos = models.BooleanField(default=False)
    fecha_registro = models.DateTimeField(default=timezone.now)
    # Una persona = una cuenta: el documento es único. Las cuentas creadas antes de esta regla quedan sin documento
    # (NULL no choca con la restricción única en SQLite ni en MySQL).
    tipo_documento = models.CharField(max_length=3, choices=TipoDocumento.choices, blank=True)
    numero_documento = models.CharField(max_length=20, null=True, blank=True)
    # Solo una cuenta con el correo confirmado puede votar
    correo_verificado = models.BooleanField(default=False)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["nombres", "apellidos"]

    objects = UsuarioManager()

    class Meta:
        db_table = "usuario"
        verbose_name = "usuario"
        verbose_name_plural = "usuarios"
        constraints = [
            models.UniqueConstraint(fields=["tipo_documento", "numero_documento"], name="usuario_documento_unico"),
        ]

    def __str__(self):
        return f"{self.nombres} {self.apellidos} <{self.email}>"

    @property
    def es_administrador(self):
        """Rol de acceso total (cambia roles, usuarios y permisos)."""
        return self.rol == self.Rol.ADMINISTRADOR

    @cached_property
    def permisos(self):
        """Permisos efectivos del rol (vacío si la cuenta está desactivada o el rol no existe)."""
        if not self.is_active:
            return frozenset()
        if self.rol == self.Rol.ADMINISTRADOR:
            return catalogo.TODOS
        rol = Rol.objects.filter(codigo=self.rol).first()
        return rol.permisos_efectivos if rol else frozenset()

    def tiene_permiso(self, *codigos):
        """True si tiene todos los permisos indicados."""
        return all(codigo in self.permisos for codigo in codigos)

    @property
    def accede_panel(self):
        return self.tiene_permiso("panel.ver")

    def refrescar_permisos(self):
        self.__dict__.pop("permisos", None)

    # Django Admin: solo con el permiso django_admin.acceder (sin asignar permisos de modelo uno por uno)
    def has_perm(self, perm, obj=None):
        return self.tiene_permiso("django_admin.acceder") or super().has_perm(perm, obj)

    def has_module_perms(self, app_label):
        return self.tiene_permiso("django_admin.acceder") or super().has_module_perms(app_label)
