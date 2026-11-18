from django.conf import settings
from django.db import models


class RegistroSistema(models.Model):
    """Un error (o aviso) técnico: del servidor (Django) o de la web (navegador del usuario)."""

    class Fuente(models.TextChoices):
        SERVIDOR = "servidor", "Servidor"
        WEB = "web", "Web (navegador)"

    fecha_hora = models.DateTimeField(auto_now_add=True, db_index=True)
    nivel = models.CharField(max_length=10, db_index=True, help_text="WARNING, ERROR o CRITICAL.")
    fuente = models.CharField(max_length=10, choices=Fuente.choices, default=Fuente.SERVIDOR, db_index=True)
    origen = models.CharField(max_length=100, help_text="Logger que lo registró (django.request, votaciones.correo…).")
    mensaje = models.TextField()
    excepcion = models.CharField(max_length=255, blank=True, help_text="Tipo y mensaje de la excepción.")
    traza = models.TextField(blank=True, help_text="Traza completa (traceback o stack del navegador).")
    archivo = models.CharField(max_length=255, blank=True, help_text="Archivo donde ocurrió el fallo.")
    linea = models.PositiveIntegerField(null=True, blank=True)
    funcion = models.CharField(max_length=120, blank=True)
    metodo = models.CharField(max_length=10, blank=True)
    ruta = models.CharField(max_length=500, blank=True)
    estado_http = models.PositiveSmallIntegerField(null=True, blank=True)
    id_solicitud = models.CharField(max_length=32, blank=True, db_index=True, help_text="X-Request-ID de la petición.")
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="registros_sistema"
    )
    ip = models.GenericIPAddressField(null=True, blank=True)
    navegador = models.CharField(max_length=300, blank=True)
    detalle = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "registro_sistema"
        ordering = ["-fecha_hora", "-id"]
        verbose_name = "registro del sistema"
        verbose_name_plural = "registros del sistema"

    def __str__(self):
        return f"{self.nivel} {self.origen}: {self.mensaje[:60]}"

    @property
    def ubicacion(self):
        """«votaciones/votacion/servicios.py:42 (emitir_voto)» o vacío."""
        if not self.archivo:
            return ""
        texto = f"{self.archivo}:{self.linea}" if self.linea else self.archivo
        return f"{texto} ({self.funcion})" if self.funcion else texto
