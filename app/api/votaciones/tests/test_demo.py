"""Cuentas y datos de demostración: permitir su ingreso, eliminarlos y volver a cargarlos sin perder el acceso."""

from datetime import date
from unittest import mock

from votaciones.models import ConfiguracionSitio, Edicion, RedSocial, Usuario
from votaciones.sitio import demo

from .base import BaseAPITest

CLAVES = {"DEMO_CLAVE_ADMIN": "Admin*Prueba2027", "DEMO_CLAVE_VOTANTE": "Voto*Prueba2027"}


class CuentasDemoTests(BaseAPITest):
    def setUp(self):
        super().setUp()
        # La base de las pruebas crea admin@festival.test (cuenta de demostración); aquí se agrega un administrador propio
        self.admin_demo = self.admin
        self.admin = Usuario.objects.create_user(
            "ana@fundacion.test", "Propia*2027segura", nombres="Ana", apellidos="Propia", rol=Usuario.Rol.ADMINISTRADOR,
            acepta_tratamiento_datos=True, correo_verificado=True,
        )

    def login(self, correo, clave):
        return self.client.post("/api/auth/login/", {"email": correo, "password": clave}, format="json")

    def test_apagadas_no_pueden_iniciar_sesion(self):
        self.assertEqual(self.login("admin@festival.test", "Admin2027*seguro").status_code, 200)
        ConfiguracionSitio.objects.update_or_create(pk=1, defaults={"permitir_cuentas_demo": False})
        self.assertNotEqual(self.login("admin@festival.test", "Admin2027*seguro").status_code, 200)
        # Las cuentas propias siguen entrando, también en el sitio MVT
        self.assertEqual(self.login(self.admin.email, "Propia*2027segura").status_code, 200)
        self.assertFalse(self.client.login(email="admin@festival.test", password="Admin2027*seguro"))

    def test_una_cuenta_demo_no_puede_apagarse_a_si_misma(self):
        self.autenticar(self.admin_demo)
        respuesta = self.client.patch("/api/gestion/configuracion/", {"permitir_cuentas_demo": False}, format="json")
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("cuenta de administrador propia", str(respuesta.data))
        self.autenticar(self.admin)
        respuesta = self.client.patch("/api/gestion/configuracion/", {"permitir_cuentas_demo": False}, format="json")
        self.assertEqual(respuesta.status_code, 200)
        self.assertFalse(ConfiguracionSitio.obtener().permitir_cuentas_demo)

    def test_eliminar_conserva_lo_propio_y_el_sitio(self):
        propia = Edicion.objects.create(nombre="Edición propia", anio=2031, fecha_inicio=date(2031, 4, 1), fecha_fin=date(2031, 4, 5),
                                        estado=Edicion.Estado.CERRADA)
        ConfiguracionSitio.objects.update_or_create(pk=1, defaults={"telefono": "123", "subtitulo_logo": "Oficial"})
        RedSocial.objects.create(nombre="Facebook", url="https://facebook.com/x", icono="facebook")
        self.autenticar(self.admin_demo)
        self.assertEqual(self.client.post("/api/gestion/demo/eliminar/").status_code, 400)
        self.autenticar(self.admin)
        respuesta = self.client.post("/api/gestion/demo/eliminar/")
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertFalse(Edicion.objects.filter(anio__in=demo.ANIOS_DEMO).exists())  # la 2027 de BaseAPITest es de demostración
        self.assertTrue(Edicion.objects.filter(pk=propia.pk).exists())
        self.assertFalse(Usuario.objects.filter(email="admin@festival.test").exists())
        self.assertTrue(Usuario.objects.filter(pk=self.admin.pk).exists())
        configuracion = ConfiguracionSitio.obtener()
        self.assertEqual((configuracion.telefono, configuracion.subtitulo_logo), ("123", "Oficial"))
        self.assertEqual(RedSocial.objects.count(), 1)

    def test_volver_a_cargar(self):
        ConfiguracionSitio.objects.update_or_create(pk=1, defaults={"telefono": "123"})
        self.autenticar(self.admin)
        with mock.patch.dict("os.environ", CLAVES):
            respuesta = self.client.post("/api/gestion/demo/cargar/")
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data["ediciones"], 3)
        self.assertTrue(Usuario.objects.filter(email="votante@festival.test").exists())
        self.assertEqual(ConfiguracionSitio.obtener().telefono, "123")
        self.assertEqual(self.client.get("/api/gestion/demo/").data["ediciones"], 3)

    def test_panel_mvt(self):
        # Una cuenta demo no puede apagar las cuentas demo (quedaría fuera)
        self.client.force_login(self.admin_demo)
        respuesta = self.client.post("/panel/configuracion/demo", {})
        self.assertEqual(respuesta.status_code, 302)
        self.assertTrue(ConfiguracionSitio.obtener().permitir_cuentas_demo)
        self.client.force_login(self.admin)
        self.assertContains(self.client.get("/panel/configuracion/demo"), "Volver a cargar")
        self.client.post("/panel/configuracion/demo/eliminar", {"confirmacion": "otra cosa"})
        self.assertTrue(Edicion.objects.filter(anio=2027).exists())
        self.client.post("/panel/configuracion/demo/eliminar", {"confirmacion": "ELIMINAR"})
        self.assertFalse(Edicion.objects.filter(anio=2027).exists())
        self.client.post("/panel/configuracion/demo", {})
        self.assertFalse(ConfiguracionSitio.obtener().permitir_cuentas_demo)
