"""Tema editable de /panel/marca: se guarda en la configuración del sitio y se publica en /sitio/."""
from votaciones.models import ConfiguracionSitio

from .base import BaseAPITest


class MarcaEditableTests(BaseAPITest):
    def setUp(self):
        super().setUp()
        self.autenticar(self.admin)

    def test_guarda_y_publica_la_marca(self):
        marca = {
            "colores": {"--flv-rojo": "#1565C0"},
            "botones": {"primario": {"estilo": "degradado", "forma": "pildora"}, "secundario": {"color": "#2E7D32"}},
            "alertas": {"estilo": "lateral"},
        }
        r = self.client.patch("/api/admin/configuracion/", {"marca": marca}, format="json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(ConfiguracionSitio.obtener().marca, marca)
        self.salir()
        self.assertEqual(self.client.get("/api/sitio/").data["configuracion"]["marca"], marca)

    def test_rechaza_valores_no_validos(self):
        for marca in (
            {"colores": {"--flv-rojo": "red"}},
            {"colores": {"--otro": "#FFFFFF"}},
            {"botones": {"primario": {"estilo": "neon"}}},
            {"botones": {"terciario": {}}},
            {"alertas": {"estilo": "parpadeo"}},
            {"script": "x"},
        ):
            r = self.client.patch("/api/admin/configuracion/", {"marca": marca}, format="json")
            self.assertEqual(r.status_code, 400, marca)
