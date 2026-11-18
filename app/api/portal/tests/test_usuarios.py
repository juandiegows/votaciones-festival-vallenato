"""Cerrar sesión, página 403 por CSRF y gestión de administradores en /panel/usuarios."""

from django.test import Client

from votaciones.models import Usuario

from .base import BasePortalTest


class CerrarSesionTest(BasePortalTest):
    def test_post_sin_token_cierra_sesion_y_lleva_al_inicio(self):
        cliente = Client(enforce_csrf_checks=True)
        cliente.force_login(self.votante)
        respuesta = cliente.post("/logout")
        self.assertRedirects(respuesta, "/", fetch_redirect_response=False)
        self.assertNotIn("_auth_user_id", cliente.session)

    def test_get_tambien_cierra_sesion(self):
        self.client.force_login(self.votante)
        self.assertRedirects(self.client.get("/logout"), "/", fetch_redirect_response=False)
        self.assertNotIn("_auth_user_id", self.client.session)

    def test_csrf_fallido_muestra_la_pagina_403_del_sitio(self):
        cliente = Client(enforce_csrf_checks=True)
        respuesta = cliente.post("/login", {"username": "x", "password": "y"})
        self.assertEqual(respuesta.status_code, 403)
        self.assertContains(respuesta, "caducó", status_code=403)
        self.assertContains(respuesta, "navbar", status_code=403)  # con el menú y la marca del sitio


class UsuariosPanelTest(BasePortalTest):
    def setUp(self):
        super().setUp()
        self.entrar_como_admin()

    def test_hacer_administrador_y_quitarlo(self):
        self.assertContains(self.client.get("/panel/usuarios"), self.votante.email)
        self.client.post(f"/panel/usuarios/{self.votante.pk}/rol", {"rol": "administrador"})
        self.votante.refresh_from_db()
        self.assertEqual(self.votante.rol, Usuario.Rol.ADMINISTRADOR)
        self.client.post(f"/panel/usuarios/{self.votante.pk}/rol", {"rol": "votante"})
        self.votante.refresh_from_db()
        self.assertEqual(self.votante.rol, Usuario.Rol.VOTANTE)

    def test_nadie_se_quita_su_propio_rol_ni_queda_sin_administradores(self):
        self.client.post(f"/panel/usuarios/{self.admin.pk}/rol", {"rol": "votante"})
        self.admin.refresh_from_db()
        self.assertEqual(self.admin.rol, Usuario.Rol.ADMINISTRADOR)

    def test_el_votante_no_entra(self):
        self.client.force_login(self.votante)
        self.assertEqual(self.client.get("/panel/usuarios").status_code, 403)
        self.client.post(f"/panel/usuarios/{self.votante.pk}/rol", {"rol": "administrador"})
        self.votante.refresh_from_db()
        self.assertEqual(self.votante.rol, Usuario.Rol.VOTANTE)

    def test_api_cambia_el_rol(self):
        from rest_framework.authtoken.models import Token

        token = Token.objects.create(user=self.admin)
        respuesta = self.client.post(f"/api/gestion/usuarios/{self.votante.pk}/rol/", {"rol": "administrador"},
                                     content_type="application/json", HTTP_AUTHORIZATION=f"Token {token.key}")
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.json()["rol"], "administrador")
        respuesta = self.client.post(f"/api/gestion/usuarios/{self.admin.pk}/rol/", {"rol": "votante"},
                                     content_type="application/json", HTTP_AUTHORIZATION=f"Token {token.key}")
        self.assertEqual(respuesta.status_code, 400)
