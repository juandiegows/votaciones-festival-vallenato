"""Pantalla /panel/registros y página 500 con la referencia del error."""

import json

from django.test import override_settings

from votaciones.models import Usuario
from votaciones.registros.models import RegistroSistema

from .base import BasePortalTest


@override_settings(DEBUG=False)
class RegistrosPanelTest(BasePortalTest):
    def test_solo_el_administrador_los_ve(self):
        lectura = Usuario.objects.create_user("lectura@festival.test", "Rol2027*seguro", nombres="L", apellidos="L",
                                              rol=Usuario.Rol.LECTURA, correo_verificado=True)
        for usuario in (self.votante, lectura):
            self.client.force_login(usuario)
            with self.subTest(usuario=usuario.email):
                self.assertEqual(self.client.get("/panel/registros").status_code, 403)
                self.assertNotContains(self.client.get("/panel"), "/panel/registros", status_code=200 if usuario == lectura else 403)

    def test_error_de_prueba_muestra_la_referencia_y_aparece_en_la_lista(self):
        self.entrar_como_admin()
        respuesta = self.client.post("/panel/registros/probar")
        self.assertEqual(respuesta.status_code, 500)
        referencia = respuesta["X-Request-ID"]
        self.assertContains(respuesta, "Algo salió mal", status_code=500)
        self.assertContains(respuesta, referencia, status_code=500)

        lista = self.client.get(f"/panel/registros?q={referencia}")
        self.assertContains(lista, "ErrorDePrueba")
        self.assertContains(lista, "votaciones/registros/views.py:")
        self.assertContains(lista, "Traceback")
        self.assertContains(lista, "Registros del sistema")  # enlace del menú

    def test_filtros_y_descargas(self):
        RegistroSistema.objects.create(nivel="ERROR", origen="web.cliente", fuente="web", mensaje="Falla en la web")
        RegistroSistema.objects.create(nivel="WARNING", origen="votaciones.correo", mensaje="Aviso del correo")
        self.entrar_como_admin()
        web = self.client.get("/panel/registros?fuente=web")
        self.assertContains(web, "Falla en la web")
        self.assertNotContains(web, "Aviso del correo")

        descarga = self.client.get("/panel/registros?nivel=WARNING&descargar=json")
        self.assertIn("attachment", descarga["Content-Disposition"])
        self.assertEqual([r["mensaje"] for r in json.loads(descarga.content)], ["Aviso del correo"])
        texto = self.client.get("/panel/registros?descargar=txt").content.decode()
        self.assertIn("Falla en la web", texto)

    def test_sin_errores(self):
        self.entrar_como_admin()
        self.assertContains(self.client.get("/panel/registros"), "Sin errores registrados.")
