from votaciones.models import Usuario

from .base import BaseAPITest

REGISTRO = "/api/auth/registro/"
LOGIN = "/api/auth/login/"


class RegistroTests(BaseAPITest):
    def datos(self, **cambios):
        datos = {
            "email": "Nuevo@Festival.test", "nombres": "Carlos", "apellidos": "Pérez",
            "password": "Clave-Segura-2027", "acepta_tratamiento_datos": True,
        }
        datos.update(cambios)
        return datos

    def test_registro_crea_votante_y_devuelve_token(self):
        respuesta = self.client.post(REGISTRO, self.datos(), format="json")
        self.assertEqual(respuesta.status_code, 201)
        self.assertIn("token", respuesta.data)
        usuario = Usuario.objects.get(email="nuevo@festival.test")
        self.assertEqual(usuario.rol, Usuario.Rol.VOTANTE)
        self.assertTrue(usuario.check_password("Clave-Segura-2027"))

    def test_registro_exige_aceptar_tratamiento_de_datos(self):
        respuesta = self.client.post(REGISTRO, self.datos(acepta_tratamiento_datos=False), format="json")
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("acepta_tratamiento_datos", respuesta.data)

    def test_registro_rechaza_correo_duplicado(self):
        respuesta = self.client.post(REGISTRO, self.datos(email="VOTANTE@festival.test"), format="json")
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("email", respuesta.data)

    def test_registro_rechaza_contrasena_debil(self):
        respuesta = self.client.post(REGISTRO, self.datos(password="12345678"), format="json")
        self.assertEqual(respuesta.status_code, 400)

    def test_registro_no_permite_elegir_rol_administrador(self):
        self.client.post(REGISTRO, self.datos(rol="administrador"), format="json")
        self.assertEqual(Usuario.objects.get(email="nuevo@festival.test").rol, Usuario.Rol.VOTANTE)


class LoginTests(BaseAPITest):
    def test_login_correcto(self):
        respuesta = self.client.post(LOGIN, {"email": "votante@festival.test", "password": "Voto2027*seguro"}, format="json")
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data["usuario"]["rol"], "votante")

    def test_login_incorrecto(self):
        respuesta = self.client.post(LOGIN, {"email": "votante@festival.test", "password": "mala"}, format="json")
        self.assertEqual(respuesta.status_code, 400)

    def test_perfil_y_logout(self):
        token = self.client.post(LOGIN, {"email": "votante@festival.test", "password": "Voto2027*seguro"}, format="json").data["token"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Token {token}")
        self.assertEqual(self.client.get("/api/auth/yo/").data["email"], "votante@festival.test")
        self.assertEqual(self.client.post("/api/auth/logout/").status_code, 204)
        self.assertEqual(self.client.get("/api/auth/yo/").status_code, 401)

    def test_perfil_requiere_autenticacion(self):
        self.assertEqual(self.client.get("/api/auth/yo/").status_code, 401)
