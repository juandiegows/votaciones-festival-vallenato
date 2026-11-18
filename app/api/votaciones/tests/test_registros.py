"""Registros técnicos: el interceptor atrapa los errores no controlados y quedan con su traza, archivo y línea."""

import json
import logging

from django.test import override_settings

from votaciones.registros.models import RegistroSistema

from .base import BaseAPITest


@override_settings(DEBUG=False)
class InterceptorRegistrosTest(BaseAPITest):
    def test_cada_respuesta_lleva_su_referencia(self):
        respuesta = self.client.get("/api/categorias/")
        self.assertRegex(respuesta["X-Request-ID"], r"^[0-9a-f]{12}$")

    def test_reutiliza_la_referencia_valida_del_proxy(self):
        respuesta = self.client.get("/api/categorias/", HTTP_X_REQUEST_ID="abc123def456")
        self.assertEqual(respuesta["X-Request-ID"], "abc123def456")
        falsa = self.client.get("/api/categorias/", HTTP_X_REQUEST_ID="<script>")
        self.assertNotEqual(falsa["X-Request-ID"], "<script>")

    def test_error_no_controlado_responde_500_con_referencia_y_queda_registrado(self):
        self.autenticar(self.admin)
        respuesta = self.client.post("/api/gestion/registros/probar/")
        self.assertEqual(respuesta.status_code, 500)
        cuerpo = respuesta.json()
        self.assertEqual(cuerpo["codigo"], "error_interno")
        self.assertEqual(cuerpo["referencia"], respuesta["X-Request-ID"])

        registro = RegistroSistema.objects.get()
        self.assertEqual(registro.nivel, "ERROR")
        self.assertEqual(registro.fuente, "servidor")
        self.assertEqual(registro.origen, "votaciones.errores")
        self.assertTrue(registro.excepcion.startswith("ErrorDePrueba: Error de prueba provocado por admin@festival.test"))
        self.assertEqual(registro.archivo, "votaciones/registros/views.py")
        self.assertEqual(registro.funcion, "provocar_error_de_prueba")
        self.assertIsNotNone(registro.linea)
        self.assertIn("Traceback", registro.traza)
        self.assertEqual((registro.metodo, registro.ruta, registro.estado_http), ("POST", "/api/gestion/registros/probar/", 500))
        self.assertEqual(registro.usuario, self.admin)
        self.assertEqual(registro.id_solicitud, cuerpo["referencia"])
        self.assertEqual(registro.ip, "127.0.0.1")

    def test_errores_esperados_no_se_registran(self):
        self.client.get("/api/no-existe/")
        self.client.post("/api/auth/login/", {"email": "admin@festival.test", "password": "mala"}, format="json")
        self.autenticar(self.votante)
        self.client.get("/api/gestion/registros/")
        self.assertFalse(RegistroSistema.objects.exists())

    def test_error_registrado_fuera_de_una_peticion(self):
        try:
            1 / 0  # noqa: B018
        except ZeroDivisionError:
            logging.getLogger("votaciones.correo").exception("Fallo al enviar")
        registro = RegistroSistema.objects.get()
        self.assertEqual(registro.excepcion, "ZeroDivisionError: division by zero")
        self.assertEqual(registro.archivo, "votaciones/tests/test_registros.py")
        self.assertEqual(registro.ruta, "")

    def test_los_avisos_no_llegan_a_la_base_de_datos(self):
        logging.getLogger("votaciones.correo").warning("Correo de consola")
        self.assertFalse(RegistroSistema.objects.exists())


class ApiRegistrosTest(BaseAPITest):
    def setUp(self):
        super().setUp()
        RegistroSistema.objects.create(nivel="ERROR", origen="votaciones.errores", mensaje="Falla A",
                                       excepcion="KeyError: 'x'", id_solicitud="aaaa1111bbbb")
        RegistroSistema.objects.create(nivel="ERROR", origen="web.cliente", fuente="web", mensaje="Falla B")

    def test_solo_con_permiso(self):
        self.assertEqual(self.client.get("/api/gestion/registros/").status_code, 401)
        self.autenticar(self.votante)
        self.assertEqual(self.client.get("/api/gestion/registros/").status_code, 403)

    def test_lista_filtra_y_resume(self):
        self.autenticar(self.admin)
        datos = self.client.get("/api/gestion/registros/").json()
        self.assertEqual(datos["count"], 2)
        self.assertEqual(self.client.get("/api/gestion/registros/?q=aaaa1111bbbb").json()["count"], 1)
        self.assertEqual(self.client.get("/api/gestion/registros/?fuente=web").json()["results"][0]["mensaje"], "Falla B")
        self.assertEqual(self.client.get("/api/gestion/registros/resumen/").json()["errores_24h"], 2)

    def test_la_web_reporta_sus_errores(self):
        respuesta = self.client.post("/api/registros/web/", {
            "mensaje": "Cannot read properties of undefined (reading 'nombre')", "tipo": "TypeError",
            "traza": "TypeError: …\n    at Votacion (Votacion.jsx:42:7)", "archivo": "https://sitio/assets/index.js",
            "linea": 42, "columna": 7, "url": "https://sitio/2027/categorias/musica", "version": "abc123",
        }, format="json")
        self.assertEqual(respuesta.status_code, 204)
        registro = RegistroSistema.objects.get(origen="web.cliente", mensaje__startswith="TypeError")
        self.assertEqual(registro.fuente, "web")
        self.assertEqual((registro.archivo, registro.linea, registro.funcion), ("https://sitio/assets/index.js", 42, "columna 7"))
        self.assertEqual(registro.detalle["url"], "https://sitio/2027/categorias/musica")
        self.assertIn("Votacion.jsx:42", registro.traza)

    def test_reporte_de_la_web_invalido(self):
        self.assertEqual(self.client.post("/api/registros/web/", {}, format="json").status_code, 400)

    def test_formato_json_de_la_consola(self):
        from votaciones.registros.registro import FiltroContexto, FormatoJSON

        registro = logging.LogRecord("votaciones.correo", logging.ERROR, __file__, 10, "Hola %s", ("mundo",), None)
        FiltroContexto().filter(registro)
        linea = json.loads(FormatoJSON().format(registro))
        self.assertEqual((linea["nivel"], linea["mensaje"], linea["id_solicitud"]), ("ERROR", "Hola mundo", "-"))
        self.assertEqual(linea["archivo"], "votaciones/tests/test_registros.py:10")
