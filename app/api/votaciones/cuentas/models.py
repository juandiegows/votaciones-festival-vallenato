from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils import timezone


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
        VOTANTE = "votante", "Votante"
        ADMINISTRADOR = "administrador", "Administrador"

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
    rol = models.CharField(max_length=20, choices=Rol.choices, default=Rol.VOTANTE)
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
        return self.rol == self.Rol.ADMINISTRADOR
