from django.test import RequestFactory, override_settings

from votaciones.models import Opcion, Votacion, Voto
from votaciones.servicios import ip_cliente

from .base import BaseAPITest


class IpClienteTests(BaseAPITest):
    def peticion(self, **meta):
        return RequestFactory().get("/", REMOTE_ADDR="10.0.0.5", **meta)

    @override_settings(NUM_PROXIES=0)
    def test_sin_proxies_ignora_x_forwarded_for(self):
        self.assertEqual(ip_cliente(self.peticion(HTTP_X_FORWARDED_FOR="1.2.3.4")), "10.0.0.5")

    @override_settings(NUM_PROXIES=1)
    def test_con_proxy_toma_la_ip_que_agrego_el_proxy(self):
        # El cliente escribe «1.2.3.4»; el proxy agrega la IP real al final
        ip = ip_cliente(self.peticion(HTTP_X_FORWARDED_FOR="1.2.3.4, 181.50.20.10"))
        self.assertEqual(ip, "181.50.20.10")

    @override_settings(NUM_PROXIES=1)
    def test_valor_que_no_es_ip_queda_vacio(self):
        self.assertIsNone(ip_cliente(self.peticion(HTTP_X_FORWARDED_FOR="no-es-una-ip")))

    @override_settings(NUM_PROXIES=1)
    def test_voto_con_encabezado_falso_no_falla(self):
        self.autenticar(self.votante)
        respuesta = self.client.post(
            f"/api/votaciones/{self.abierta.pk}/votar/", {"opcion": self.opcion_a.pk}, format="json",
            HTTP_X_FORWARDED_FOR="x" * 200,
        )
        self.assertEqual(respuesta.status_code, 201)
        self.assertIsNone(Voto.objects.get().ip)


class ParametrosInvalidosTests(BaseAPITest):
    def test_filtros_no_numericos_devuelven_lista_vacia(self):
        for ruta in ("/api/votaciones/?categoria=abc", "/api/categorias/?edicion=abc", "/api/categorias/?anio=x",
                     "/api/opciones/?votacion=1;DROP"):
            with self.subTest(ruta=ruta):
                respuesta = self.client.get(ruta)
                self.assertEqual(respuesta.status_code, 200)
                self.assertEqual(respuesta.data, [])

    def test_filtros_admin_no_numericos(self):
        self.autenticar(self.admin)
        for ruta in ("/api/gestion/votaciones/?categoria=abc", "/api/gestion/opciones/?votacion=abc",
                     "/api/gestion/votos/?votacion=abc", "/api/gestion/banners/?edicion=abc"):
            with self.subTest(ruta=ruta):
                self.assertEqual(self.client.get(ruta).status_code, 200)


class PublicarResultadosTests(BaseAPITest):
    def setUp(self):
        super().setUp()
        self.autenticar(self.admin)

    def test_texto_false_oculta_los_resultados(self):
        Votacion.objects.filter(pk=self.abierta.pk).update(resultados_publicados=True)
        ruta = f"/api/gestion/votaciones/{self.abierta.pk}/publicar-resultados/"
        respuesta = self.client.post(ruta, {"publicar": "false"}, format="json")
        self.assertEqual(respuesta.status_code, 200)
        self.abierta.refresh_from_db()
        self.assertFalse(self.abierta.resultados_publicados)

    def test_valor_invalido_responde_400(self):
        ruta = f"/api/gestion/ediciones/{self.edicion.pk}/publicar-resultados/"
        self.assertEqual(self.client.post(ruta, {"publicar": "quizas"}, format="json").status_code, 400)


class ExportarCsvTests(BaseAPITest):
    def test_neutraliza_formulas(self):
        Opcion.objects.filter(pk=self.opcion_a.pk).update(nombre='=HYPERLINK("http://malo.test","clic")')
        self.autenticar(self.admin)
        contenido = self.client.get(f"/api/gestion/votaciones/{self.abierta.pk}/resultados/csv/").content.decode()
        self.assertIn("'=HYPERLINK", contenido)
        self.assertNotIn('\n"=HYPERLINK', contenido)
