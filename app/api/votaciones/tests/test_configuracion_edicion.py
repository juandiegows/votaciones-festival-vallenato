from votaciones.models import ConfiguracionSitio, Voto

from .base import BaseAPITest


class ConfiguracionEdicionTests(BaseAPITest):
    def votar(self, votacion, opcion):
        return self.client.post(f"/api/votaciones/{votacion.pk}/votar/", {"opcion": opcion.pk}, format="json")

    def test_limite_de_votos_heredado_de_la_edicion(self):
        self.edicion.votos_por_usuario = 2
        self.edicion.save()
        self.autenticar(self.votante)
        self.assertEqual(self.votar(self.abierta, self.opcion_a).status_code, 201)
        self.assertEqual(self.votar(self.abierta, self.opcion_b).status_code, 201)
        self.assertEqual(self.votar(self.abierta, self.opcion_a).data["codigo"], "limite_votos")
        self.assertEqual(self.client.get(f"/api/votaciones/{self.abierta.pk}/").data["votos_por_usuario"], 2)

    def test_limite_personalizado_no_toma_el_de_la_edicion(self):
        self.edicion.votos_por_usuario = 3
        self.edicion.save()
        self.abierta.votos_por_usuario = 1
        self.abierta.personalizar_votos = True
        self.abierta.save()
        self.autenticar(self.votante)
        self.assertEqual(self.votar(self.abierta, self.opcion_a).status_code, 201)
        self.assertEqual(self.votar(self.abierta, self.opcion_b).status_code, 409)

    def test_pausa_de_la_edicion_impide_votar(self):
        self.edicion.votaciones_pausadas = True
        self.edicion.save()
        self.autenticar(self.votante)
        respuesta = self.votar(self.abierta, self.opcion_a)
        self.assertEqual(respuesta.status_code, 409)
        self.assertEqual(respuesta.data["codigo"], "votaciones_pausadas")
        self.assertTrue(self.client.get(f"/api/votaciones/{self.abierta.pk}/").data["pausada"])
        self.assertEqual(Voto.objects.count(), 0)

    def test_publicar_resultados_de_toda_la_edicion(self):
        self.abierta.visibilidad_resultados = "no_publicar"
        self.abierta.personalizar_resultados = True
        self.abierta.save()
        self.assertEqual(self.client.get(f"/api/votaciones/{self.abierta.pk}/resultados/").status_code, 403)
        self.autenticar(self.admin)
        respuesta = self.client.post(f"/api/admin/ediciones/{self.edicion.pk}/publicar-resultados/", {"publicar": True}, format="json")
        self.assertEqual(respuesta.status_code, 200)
        self.assertGreaterEqual(respuesta.data["actualizadas"], 1)
        self.salir()
        self.assertEqual(self.client.get(f"/api/votaciones/{self.abierta.pk}/resultados/").status_code, 200)

    def test_votante_no_publica_resultados_de_la_edicion(self):
        self.autenticar(self.votante)
        self.assertEqual(self.client.post(f"/api/admin/ediciones/{self.edicion.pk}/publicar-resultados/", {}, format="json").status_code, 403)

    def test_total_de_votos_en_el_sitio_solo_si_se_habilita(self):
        Voto.objects.create(usuario=self.votante, votacion=self.abierta, opcion=self.opcion_a, codigo_comprobante="FLV27-TOTAL1")
        self.assertIsNone(self.client.get("/api/sitio/").data["total_votos"])
        configuracion = ConfiguracionSitio.obtener()
        configuracion.mostrar_total_votos = True
        configuracion.save()
        self.assertEqual(self.client.get("/api/sitio/").data["total_votos"], 1)
