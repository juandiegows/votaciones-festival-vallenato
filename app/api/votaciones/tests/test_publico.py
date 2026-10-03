from datetime import timedelta

from django.utils import timezone

from votaciones.models import Categoria, Voto

from .base import BaseAPITest


class ConsultaPublicaTests(BaseAPITest):
    def test_edicion_vigente(self):
        respuesta = self.client.get("/api/ediciones/vigente/")
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data["anio"], 2027)

    def test_categorias_solo_activas(self):
        Categoria.objects.create(edicion=self.edicion, nombre="Inactiva", activa=False)
        nombres = [c["nombre"] for c in self.client.get("/api/categorias/").data]
        self.assertEqual(nombres, ["Música"])

    def test_votaciones_excluye_borradores(self):
        ahora = timezone.now()
        self.crear_votacion("Borrador", ahora, ahora + timedelta(days=1), publicada=False)
        titulos = [v["titulo"] for v in self.client.get("/api/votaciones/").data]
        self.assertEqual(titulos, ["Canción favorita del público"])

    def test_filtro_por_estado(self):
        ahora = timezone.now()
        self.crear_votacion("Futura", ahora + timedelta(days=2), ahora + timedelta(days=4))
        abiertas = self.client.get("/api/votaciones/", {"estado": "abierta"}).data
        programadas = self.client.get("/api/votaciones/", {"estado": "programada"}).data
        self.assertEqual([v["titulo"] for v in abiertas], ["Canción favorita del público"])
        self.assertEqual([v["titulo"] for v in programadas], ["Futura"])

    def test_detalle_incluye_opciones_activas(self):
        self.opcion_b.activa = False
        self.opcion_b.save()
        respuesta = self.client.get(f"/api/votaciones/{self.abierta.pk}/")
        self.assertEqual(respuesta.data["estado"], "abierta")
        self.assertEqual([o["nombre"] for o in respuesta.data["opciones"]], ["Canción A"])
        self.assertEqual(respuesta.data["mis_votos"], 0)

    def test_publico_no_puede_escribir(self):
        respuesta = self.client.post("/api/categorias/", {"nombre": "X", "edicion": self.edicion.pk})
        self.assertEqual(respuesta.status_code, 405)


class VisibilidadResultadosTests(BaseAPITest):
    def url(self, votacion):
        return f"/api/votaciones/{votacion.pk}/resultados/"

    def test_al_cierre_oculta_resultados_mientras_esta_abierta(self):
        self.assertEqual(self.client.get(self.url(self.abierta)).status_code, 403)

    def test_tiempo_real_muestra_resultados(self):
        self.abierta.visibilidad_resultados = "tiempo_real"
        self.abierta.personalizar_resultados = True
        self.abierta.save()
        Voto.objects.create(usuario=self.votante, votacion=self.abierta, opcion=self.opcion_a, codigo_comprobante="FLV27-AAAAAA")
        datos = self.client.get(self.url(self.abierta)).data
        self.assertEqual(datos["total_votos"], 1)
        self.assertEqual(datos["resultados"][0]["opcion"], "Canción A")
        self.assertEqual(datos["resultados"][0]["porcentaje"], 100.0)

    def test_al_cierre_muestra_cuando_cierra(self):
        self.abierta.cerrada_manualmente = True
        self.abierta.save()
        self.assertEqual(self.client.get(self.url(self.abierta)).status_code, 200)

    def test_no_publicar_oculta_incluso_cerrada(self):
        self.abierta.visibilidad_resultados = "no_publicar"
        self.abierta.personalizar_resultados = True
        self.abierta.cerrada_manualmente = True
        self.abierta.save()
        self.assertEqual(self.client.get(self.url(self.abierta)).status_code, 403)

    def test_visibilidad_heredada_de_la_edicion(self):
        self.edicion.visibilidad_resultados = "tiempo_real"
        self.edicion.save()
        self.abierta.visibilidad_resultados = "no_publicar"  # sin personalizar: se ignora
        self.abierta.save()
        self.assertEqual(self.client.get(self.url(self.abierta)).status_code, 200)
        self.edicion.visibilidad_resultados = "no_publicar"
        self.edicion.save()
        self.assertEqual(self.client.get(self.url(self.abierta)).status_code, 403)

    def test_votacion_personalizada_no_toma_la_de_la_edicion(self):
        self.edicion.visibilidad_resultados = "no_publicar"
        self.edicion.save()
        self.abierta.visibilidad_resultados = "tiempo_real"
        self.abierta.personalizar_resultados = True
        self.abierta.save()
        self.assertEqual(self.client.get(self.url(self.abierta)).status_code, 200)
        detalle = self.client.get(f"/api/votaciones/{self.abierta.pk}/").data
        self.assertEqual(detalle["visibilidad_resultados"], "tiempo_real")

    def test_resultados_publicados_manualmente(self):
        self.abierta.visibilidad_resultados = "no_publicar"
        self.abierta.personalizar_resultados = True
        self.abierta.resultados_publicados = True
        self.abierta.save()
        self.assertEqual(self.client.get(self.url(self.abierta)).status_code, 200)
