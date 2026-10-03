from datetime import date, timedelta

from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone

from votaciones.models import Categoria, ConfiguracionSitio, Edicion

from .base import BaseAPITest


@override_settings(CORREO_URL_SITIO="https://votaciones.ejemplo.test/")
class SitemapTest(BaseAPITest):
    def obtener(self):
        respuesta = self.client.get("/api/sitemap.xml")
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta["Content-Type"], "application/xml; charset=utf-8")
        return respuesta.content.decode()

    def test_incluye_paginas_publicas_con_url_absoluta(self):
        xml = self.obtener()
        self.assertIn("<loc>https://votaciones.ejemplo.test/</loc>", xml)
        self.assertIn("<loc>https://votaciones.ejemplo.test/registro</loc>", xml)
        self.assertIn("<loc>https://votaciones.ejemplo.test/2027</loc>", xml)
        self.assertIn("<loc>https://votaciones.ejemplo.test/2027/categorias/musica</loc>", xml)
        self.assertIn(f"<loc>https://votaciones.ejemplo.test/2027/categorias/musica/{self.abierta.slug}</loc>", xml)

    def test_excluye_paginas_privadas(self):
        xml = self.obtener()
        for ruta in ("/login", "/mis-votos", "/panel", "/comprobante"):
            self.assertNotIn(ruta + "<", xml)

    def test_excluye_borradores_categorias_inactivas_y_ediciones_cerradas(self):
        ahora = timezone.now()
        borrador = self.crear_votacion("Borrador oculto", ahora, ahora + timedelta(days=2), publicada=False)
        inactiva = Categoria.objects.create(edicion=self.edicion, nombre="Inactiva", activa=False)
        cerrada = Edicion.objects.create(
            nombre="Festival 2026", anio=2026, fecha_inicio=date(2026, 4, 28), fecha_fin=date(2026, 5, 1),
            estado=Edicion.Estado.CERRADA,
        )
        xml = self.obtener()
        self.assertNotIn(borrador.slug, xml)
        self.assertNotIn(inactiva.slug, xml)
        self.assertNotIn(f"/{cerrada.anio}<", xml)

    def test_respeta_dias_visibles_de_votaciones_cerradas(self):
        ahora = timezone.now()
        vieja = self.crear_votacion("Cerrada hace tiempo", ahora - timedelta(days=30), ahora - timedelta(days=20))
        reciente = self.crear_votacion("Cerrada ayer", ahora - timedelta(days=5), ahora - timedelta(days=1))
        xml = self.obtener()
        self.assertNotIn(vieja.slug, xml)
        self.assertIn(reciente.slug, xml)

        # «Siempre visibles»: el mapa (cacheado 15 min) se regenera al vaciar la caché
        configuracion = ConfiguracionSitio.obtener()
        configuracion.dias_visible_cerradas = None
        configuracion.save()
        cache.clear()
        self.assertIn(vieja.slug, self.obtener())
