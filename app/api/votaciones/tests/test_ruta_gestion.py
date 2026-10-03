from .base import BaseAPITest


class RutaGestionTests(BaseAPITest):
    """La administración responde en /api/gestion/ (el WAF de producción bloquea /api/admin/)."""

    def test_gestion_responde_igual_que_el_alias(self):
        self.autenticar(self.admin)
        for ruta in ["ediciones/", "votaciones/", "auditoria/", "configuracion/"]:
            self.assertEqual(self.client.get(f"/api/gestion/{ruta}").status_code, 200, ruta)
            self.assertEqual(self.client.get(f"/api/admin/{ruta}").status_code, 200, ruta)

    def test_gestion_exige_administrador(self):
        self.autenticar(self.votante)
        self.assertEqual(self.client.get("/api/gestion/ediciones/").status_code, 403)
