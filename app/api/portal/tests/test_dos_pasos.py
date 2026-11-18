"""Verificación en dos pasos en el sitio MVT (RF-20, CU-15): /cuenta/seguridad y el paso 2 de /login."""

import re

from django.core import mail
from django.test import override_settings

from votaciones.cuentas import servicios_2fa
from votaciones.models import SegundoFactor, Usuario

from .base import BasePortalTest

CLAVE = "Clave-Segura-2027"


@override_settings(CORREO_ADAPTADOR="smtp", CORREO_EN_SEGUNDO_PLANO=False)
class DosPasosPortalTest(BasePortalTest):
    def setUp(self):
        super().setUp()
        self.persona = Usuario.objects.create_user(
            "persona@correo.test", CLAVE, nombres="Rosa", apellidos="Mendoza", acepta_tratamiento_datos=True,
            correo_verificado=True,
        )

    def post(self, ruta, datos, **extra):
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(ruta, datos, **extra)

    def activar_totp(self):
        self.client.force_login(self.persona)
        self.post("/cuenta/seguridad", {"accion": "iniciar_totp"})
        respuesta = self.client.get("/cuenta/seguridad")
        self.assertContains(respuesta, "data:image/svg+xml")
        clave = servicios_2fa.clave_pendiente(self.persona)
        codigo = servicios_2fa.codigo_totp(clave, servicios_2fa.paso_actual())
        respuesta = self.post("/cuenta/seguridad", {"accion": "activar_totp", "codigo": codigo}, follow=True)
        self.assertContains(respuesta, "Guarda tus códigos de respaldo")
        self.client.logout()
        return clave

    def test_seguridad_exige_sesion(self):
        respuesta = self.client.get("/cuenta/seguridad")
        self.assertEqual(respuesta.status_code, 302)
        self.assertIn("/login", respuesta.url)

    def test_pagina_muestra_los_dos_metodos(self):
        self.client.force_login(self.persona)
        respuesta = self.client.get("/cuenta/seguridad")
        self.assertContains(respuesta, "App autenticadora")
        self.assertContains(respuesta, "Código por correo")
        self.assertContains(respuesta, "Desactivada")

    def test_codigos_de_respaldo_se_muestran_una_sola_vez(self):
        self.activar_totp()
        self.client.force_login(self.persona)
        respuesta = self.client.get("/cuenta/seguridad")
        self.assertNotContains(respuesta, "Guarda tus códigos de respaldo")
        self.assertContains(respuesta, "Activa · App autenticadora")

    def test_login_con_totp_pasa_por_verificar_acceso(self):
        clave = self.activar_totp()
        respuesta = self.post("/login", {"email": self.persona.email, "password": CLAVE})
        self.assertRedirects(respuesta, "/verificar-acceso", fetch_redirect_response=False)
        self.assertNotIn("_auth_user_id", self.client.session)
        self.assertContains(self.client.get("/verificar-acceso"), "app autenticadora")
        malo = self.post("/verificar-acceso", {"codigo": "000000"})
        self.assertContains(malo, "El código no es correcto")
        self.assertNotIn("_auth_user_id", self.client.session)
        codigo = servicios_2fa.codigo_totp(clave, servicios_2fa.paso_actual() + 1)
        respuesta = self.post("/verificar-acceso", {"codigo": codigo})
        self.assertRedirects(respuesta, "/categorias", fetch_redirect_response=False)
        self.assertEqual(int(self.client.session["_auth_user_id"]), self.persona.pk)

    def test_verificar_acceso_respeta_next(self):
        clave = self.activar_totp()
        self.post("/login", {"email": self.persona.email, "password": CLAVE, "next": "/mis-votos"})
        codigo = servicios_2fa.codigo_totp(clave, servicios_2fa.paso_actual() + 1)
        self.assertRedirects(self.post("/verificar-acceso", {"codigo": codigo}), "/mis-votos", fetch_redirect_response=False)

    def test_verificar_acceso_sin_desafio_vuelve_al_login(self):
        self.assertRedirects(self.client.get("/verificar-acceso"), "/login", fetch_redirect_response=False)

    def test_metodo_correo_y_login(self):
        self.client.force_login(self.persona)
        self.post("/cuenta/seguridad", {"accion": "iniciar_correo"})
        self.assertContains(self.client.get("/cuenta/seguridad"), "Código del correo")
        codigo = re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)
        self.post("/cuenta/seguridad", {"accion": "activar_correo", "codigo": codigo})
        self.assertEqual(SegundoFactor.objects.get(usuario=self.persona).metodo, "correo")
        self.client.logout()

        self.post("/login", {"email": self.persona.email, "password": CLAVE})
        self.assertIn("iniciar sesión", mail.outbox[-1].subject)
        self.assertContains(self.client.get("/verificar-acceso"), "Enviar otro código")
        codigo = re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)
        self.post("/verificar-acceso", {"codigo": codigo})
        self.assertEqual(int(self.client.session["_auth_user_id"]), self.persona.pk)

    def test_desactivar_con_contrasena(self):
        self.activar_totp()
        self.client.force_login(self.persona)
        self.assertContains(self.post("/cuenta/seguridad", {"accion": "desactivar", "password": "mala"}),
                            "La contraseña no es correcta")
        self.post("/cuenta/seguridad", {"accion": "desactivar", "password": CLAVE})
        self.assertFalse(servicios_2fa.activo(self.persona))

    def test_cuenta_demo_ve_aviso(self):
        self.client.force_login(self.votante)
        self.assertContains(self.client.get("/cuenta/seguridad"), "Las cuentas de demostración no usan")

    def test_menu_enlaza_seguridad(self):
        self.client.force_login(self.persona)
        self.assertContains(self.client.get("/mis-votos"), 'href="/cuenta/seguridad"')


    def test_panel_quita_la_2fa_con_motivo(self):
        self.activar_totp()
        self.entrar_como_admin()
        pagina = self.client.get("/panel/usuarios")
        self.assertContains(pagina, "Quitar (perdió el acceso)")
        ruta = f"/panel/usuarios/{self.persona.pk}/quitar-2fa"
        self.post(ruta, {"motivo": "corto"}, follow=True)
        self.assertTrue(servicios_2fa.activo(self.persona))
        respuesta = self.post(ruta, {"motivo": "Perdió el celular; identidad verificada por llamada."}, follow=True)
        self.assertContains(respuesta, "Quitaste la verificación en dos pasos")
        self.assertFalse(servicios_2fa.activo(self.persona))
