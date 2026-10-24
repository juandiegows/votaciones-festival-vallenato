import tempfile

from django.core.management import call_command
from django.test import SimpleTestCase, override_settings

PRODUCCION = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "config.estaticos.EstaticosProduccion"},
}


class EstaticosProduccionTest(SimpleTestCase):
    """En producción (DEBUG=false) collectstatic usa el manifiesto de whitenoise: falla si un CSS o JS cita un
    archivo que no existe (p. ej. un sourceMappingURL), y entonces la API no arranca."""

    def test_collectstatic_con_manifiesto(self):
        with tempfile.TemporaryDirectory() as destino, override_settings(STATIC_ROOT=destino, STORAGES=PRODUCCION):
            call_command("collectstatic", interactive=False, verbosity=0)

    def test_django_admin_no_usa_rutas_bloqueadas_por_el_waf(self):
        """El WAF responde 403 a /static/admin/…: Django Admin enlaza sus estáticos desde /static/dj-admin/."""
        from pathlib import Path

        from django.contrib.staticfiles.storage import staticfiles_storage
        from django.core.files.storage import storages

        with tempfile.TemporaryDirectory() as destino, override_settings(STATIC_ROOT=destino, STORAGES=PRODUCCION):
            call_command("collectstatic", interactive=False, verbosity=0)
            staticfiles_storage._wrapped = storages["staticfiles"]
            url = staticfiles_storage.url("admin/css/base.css")
            self.assertRegex(url, r"^/static/dj-admin/css/base\.[0-9a-f]+\.css$")
            self.assertTrue((Path(destino) / url.removeprefix("/static/")).is_file())


class MediaIncrustableTest(SimpleTestCase):
    """La portada muestra la revista (PDF de /media/) en un iframe: con X-Frame-Options DENY el navegador lo bloquea."""

    def test_media_permite_iframe_del_mismo_sitio(self):
        with tempfile.TemporaryDirectory() as raiz, override_settings(MEDIA_ROOT=raiz):
            with open(f"{raiz}/revista.pdf", "wb") as archivo:
                archivo.write(b"%PDF-1.4")
            respuesta = self.client.get("/media/revista.pdf")
            respuesta.close()  # FileResponse deja el archivo abierto (Windows no deja borrar la carpeta)
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta["X-Frame-Options"], "SAMEORIGIN")
