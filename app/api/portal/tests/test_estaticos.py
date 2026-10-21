import tempfile

from django.core.management import call_command
from django.test import SimpleTestCase, override_settings

PRODUCCION = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}


class EstaticosProduccionTest(SimpleTestCase):
    """En producción (DEBUG=false) collectstatic usa el manifiesto de whitenoise: falla si un CSS o JS cita un
    archivo que no existe (p. ej. un sourceMappingURL), y entonces la API no arranca."""

    def test_collectstatic_con_manifiesto(self):
        with tempfile.TemporaryDirectory() as destino, override_settings(STATIC_ROOT=destino, STORAGES=PRODUCCION):
            call_command("collectstatic", interactive=False, verbosity=0)
