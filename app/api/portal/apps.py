from django.apps import AppConfig


class PortalConfig(AppConfig):
    """Sitio web en Django (patrón MVT): vistas y plantillas que leen MySQL con el ORM, sin pasar por la API."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "portal"
    verbose_name = "Sitio web (MVT)"
