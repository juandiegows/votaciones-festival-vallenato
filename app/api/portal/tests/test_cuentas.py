from votaciones.cuentas import servicios
from votaciones.models import Usuario

from .base import CLAVE_VOTANTE, BasePortalTest

DATOS_REGISTRO = {
    "nombres": "Carlos", "apellidos": "Zuleta", "email": "Carlos@Correo.test",
    "password": "Vallenato2027*", "confirmacion": "Vallenato2027*", "acepta_tratamiento_datos": "on",
}


class RegistroTest(BasePortalTest):
    def test_registro_crea_la_cuenta_e_inicia_sesion(self):
        respuesta = self.client.post("/registro", DATOS_REGISTRO)
        self.assertRedirects(respuesta, "/categorias", target_status_code=302)
        usuario = Usuario.objects.get(email="carlos@correo.test")
        self.assertEqual(usuario.rol, Usuario.Rol.VOTANTE)
        self.assertFalse(usuario.correo_verificado)
        self.assertEqual(int(self.client.session["_auth_user_id"]), usuario.pk)

    def test_registro_valida_contrasena_y_politica(self):
        datos = {**DATOS_REGISTRO, "password": "corta", "confirmacion": "otra"}
        datos.pop("acepta_tratamiento_datos")
        respuesta = self.client.post("/registro", datos)
        form = respuesta.context["form"]
        self.assertIn("password", form.errors)
        self.assertIn("confirmacion", form.errors)
        self.assertIn("acepta_tratamiento_datos", form.errors)
        self.assertFalse(Usuario.objects.filter(email="carlos@correo.test").exists())

    def test_correo_repetido(self):
        respuesta = self.client.post("/registro", {**DATOS_REGISTRO, "email": "votante@festival.test"})
        self.assertIn("Ya existe una cuenta con este correo.", respuesta.context["form"].errors["email"])


class SesionTest(BasePortalTest):
    def test_login_y_logout(self):
        respuesta = self.client.post("/login", {"email": "VOTANTE@festival.test", "password": CLAVE_VOTANTE})
        self.assertRedirects(respuesta, "/categorias", target_status_code=302)
        self.assertIn("_auth_user_id", self.client.session)
        self.assertRedirects(self.client.post("/logout"), "/")
        self.assertNotIn("_auth_user_id", self.client.session)

    def test_login_incorrecto(self):
        respuesta = self.client.post("/login", {"email": "votante@festival.test", "password": "mala"})
        self.assertContains(respuesta, "Correo o contraseña incorrectos.")

    def test_administrador_va_al_panel(self):
        respuesta = self.client.post("/login", {"email": "admin@festival.test", "password": "Admin2027*seguro"})
        self.assertRedirects(respuesta, "/panel")

    def test_next_externo_se_ignora(self):
        datos = {"email": "votante@festival.test", "password": CLAVE_VOTANTE, "next": "https://otro-sitio.test/"}
        self.assertRedirects(self.client.post("/login", datos), "/categorias", target_status_code=302)

    def test_logout_solo_por_post(self):
        self.assertEqual(self.client.get("/logout").status_code, 405)

    def test_confirmar_correo(self):
        self.votante.correo_verificado = False
        self.votante.save()
        respuesta = self.client.get(f"/confirmar-correo?token={servicios.token_confirmacion(self.votante)}")
        self.assertContains(respuesta, "¡Correo confirmado!")
        self.votante.refresh_from_db()
        self.assertTrue(self.votante.correo_verificado)

    def test_confirmar_correo_con_token_invalido(self):
        self.assertContains(self.client.get("/confirmar-correo?token=falso"), "No pudimos confirmar tu correo")
