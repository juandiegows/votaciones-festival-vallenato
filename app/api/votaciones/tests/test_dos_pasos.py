"""Verificación en dos pasos por la API (RF-20, CU-15): app autenticadora (TOTP), código por correo y respaldo."""

import re
from datetime import timedelta
from unittest import mock

from django.core import mail
from django.test import SimpleTestCase, override_settings
from django.utils import timezone

from votaciones.auditoria.models import RegistroAuditoria
from votaciones.cuentas import servicios_2fa
from votaciones.models import SegundoFactor, Usuario

from .base import BaseAPITest

CLAVE = "Clave-Segura-2027"
LOGIN = "/api/auth/login/"


class TotpRfc6238Test(SimpleTestCase):
    """Vectores de prueba del anexo B de RFC 6238 (SHA-1), recortados a 6 dígitos."""

    CLAVE_RFC = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"  # "12345678901234567890" en Base32

    def test_vectores_del_rfc(self):
        for segundos, esperado in ((59, "287082"), (1111111109, "081804"), (1234567890, "005924"), (2000000000, "279037")):
            self.assertEqual(servicios_2fa.codigo_totp(self.CLAVE_RFC, segundos // 30), esperado)

    def test_tolerancia_de_un_periodo_y_sin_repetir(self):
        ahora = 1_700_000_000
        paso = servicios_2fa.paso_actual(ahora)
        anterior = servicios_2fa.codigo_totp(self.CLAVE_RFC, paso - 1)
        self.assertEqual(servicios_2fa.paso_del_codigo(self.CLAVE_RFC, anterior, ahora=ahora), paso - 1)
        viejo = servicios_2fa.codigo_totp(self.CLAVE_RFC, paso - 3)
        self.assertIsNone(servicios_2fa.paso_del_codigo(self.CLAVE_RFC, viejo, ahora=ahora))
        # Ya usado: el último paso aceptado no se vuelve a aceptar
        self.assertIsNone(servicios_2fa.paso_del_codigo(self.CLAVE_RFC, anterior, ultimo_paso=paso - 1, ahora=ahora))

    def test_uri_para_las_apps(self):
        usuario = Usuario(email="ana@correo.test")
        uri = servicios_2fa.uri_otpauth(usuario, "ABCDEF")
        self.assertTrue(uri.startswith("otpauth://totp/Votaciones%20Festival%20Vallenato%3Aana%40correo.test?secret=ABCDEF"))
        self.assertIn("issuer=Votaciones%20Festival%20Vallenato", uri)
        self.assertTrue(servicios_2fa.qr_svg(uri).startswith("data:image/svg+xml"))


class ConPersona:
    """Cuenta propia (las de la base son de demostración y no admiten 2FA) y ayudantes."""

    def setUp(self):
        super().setUp()
        # Las cuentas base son de demostración (no admiten 2FA): se usa una propia
        self.persona = Usuario.objects.create_user(
            "persona@correo.test", CLAVE, nombres="Rosa", apellidos="Mendoza", acepta_tratamiento_datos=True,
            correo_verificado=True,
        )

    def post(self, ruta, datos=None):
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(ruta, datos or {}, format="json")

    def codigo_del_correo(self):
        return re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)

    def activar_totp(self):
        self.autenticar(self.persona)
        clave = self.post("/api/auth/2fa/totp/iniciar/").data["clave"]
        codigo = servicios_2fa.codigo_totp(clave, servicios_2fa.paso_actual())
        respuesta = self.post("/api/auth/2fa/totp/activar/", {"codigo": codigo})
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.salir()
        return clave, respuesta.data["codigos_respaldo"]


@override_settings(CORREO_ADAPTADOR="smtp", CORREO_EN_SEGUNDO_PLANO=False)
class DosPasosApiTest(ConPersona, BaseAPITest):

    def test_estado_inicial_inactivo(self):
        self.autenticar(self.persona)
        respuesta = self.client.get("/api/auth/2fa/")
        self.assertEqual(respuesta.status_code, 200)
        self.assertFalse(respuesta.data["activo"])
        self.assertEqual(self.client.get("/api/auth/yo/").data["verificacion_dos_pasos"], "")

    def test_iniciar_totp_devuelve_qr_y_no_activa(self):
        self.autenticar(self.persona)
        respuesta = self.post("/api/auth/2fa/totp/iniciar/")
        self.assertEqual(respuesta.status_code, 200)
        self.assertTrue(respuesta.data["qr"].startswith("data:image/svg+xml"))
        self.assertIn(respuesta.data["clave"], respuesta.data["uri"])
        self.assertFalse(servicios_2fa.activo(self.persona))

    def test_activar_totp_con_codigo_incorrecto(self):
        self.autenticar(self.persona)
        self.post("/api/auth/2fa/totp/iniciar/")
        respuesta = self.post("/api/auth/2fa/totp/activar/", {"codigo": "000000"})
        self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(respuesta.data["codigo"], "codigo_invalido")
        self.assertFalse(servicios_2fa.activo(self.persona))

    def test_activar_totp_entrega_codigos_audita_y_avisa(self):
        _, codigos = self.activar_totp()
        self.assertEqual(len(codigos), servicios_2fa.CODIGOS_RESPALDO)
        factor = SegundoFactor.objects.get(usuario=self.persona)
        self.assertEqual(factor.metodo, "totp")
        self.assertNotIn(codigos[0], factor.codigos_respaldo)  # guardados con HMAC, nunca en claro
        self.assertTrue(RegistroAuditoria.objects.filter(accion="activar_2fa", entidad_id=str(self.persona.pk)).exists())
        self.assertIn("Activaste la verificación en dos pasos", mail.outbox[-1].subject)

    def test_login_con_totp_pide_el_paso_2(self):
        clave, _ = self.activar_totp()
        respuesta = self.post(LOGIN, {"email": self.persona.email, "password": CLAVE})
        self.assertEqual(respuesta.status_code, 200)
        self.assertTrue(respuesta.data["requiere_2fa"])
        self.assertEqual(respuesta.data["metodo"], "totp")
        self.assertNotIn("token", respuesta.data)
        # El código con el que se activó ya se gastó: se usa el del periodo siguiente
        codigo = servicios_2fa.codigo_totp(clave, servicios_2fa.paso_actual() + 1)
        verificado = self.post("/api/auth/2fa/verificar/", {"desafio": respuesta.data["desafio"], "codigo": codigo})
        self.assertEqual(verificado.status_code, 200, verificado.data)
        self.assertIn("token", verificado.data)
        self.assertEqual(verificado.data["usuario"]["verificacion_dos_pasos"], "totp")
        # El mismo código no sirve dos veces
        repetido = self.post("/api/auth/2fa/verificar/", {"desafio": respuesta.data["desafio"], "codigo": codigo})
        self.assertEqual(repetido.status_code, 400)

    def test_codigo_de_respaldo_sirve_una_vez(self):
        _, codigos = self.activar_totp()
        desafio = self.post(LOGIN, {"email": self.persona.email, "password": CLAVE}).data["desafio"]
        ok = self.post("/api/auth/2fa/verificar/", {"desafio": desafio, "codigo": codigos[0].lower()})
        self.assertEqual(ok.status_code, 200)
        self.assertTrue(RegistroAuditoria.objects.filter(accion="usar_codigo_respaldo_2fa").exists())
        otra = self.post("/api/auth/2fa/verificar/", {"desafio": desafio, "codigo": codigos[0]})
        self.assertEqual(otra.status_code, 400)

    def test_desafio_falso_o_vencido(self):
        self.activar_totp()
        falso = self.post("/api/auth/2fa/verificar/", {"desafio": "inventado", "codigo": "123456"})
        self.assertEqual(falso.data["codigo"], "desafio_invalido")
        desafio = self.post(LOGIN, {"email": self.persona.email, "password": CLAVE}).data["desafio"]
        with mock.patch("django.core.signing.time.time", return_value=timezone.now().timestamp() + 600):
            vencido = self.post("/api/auth/2fa/verificar/", {"desafio": desafio, "codigo": "123456"})
        self.assertEqual(vencido.data["codigo"], "desafio_vencido")

    def test_cambiar_la_contrasena_invalida_el_desafio(self):
        clave, _ = self.activar_totp()
        desafio = self.post(LOGIN, {"email": self.persona.email, "password": CLAVE}).data["desafio"]
        self.persona.set_password("Otra-Clave-2027")
        self.persona.save()
        codigo = servicios_2fa.codigo_totp(clave, servicios_2fa.paso_actual() + 1)
        respuesta = self.post("/api/auth/2fa/verificar/", {"desafio": desafio, "codigo": codigo})
        self.assertEqual(respuesta.data["codigo"], "desafio_invalido")

    def test_bloqueo_tras_varios_fallos(self):
        clave, _ = self.activar_totp()
        desafio = self.post(LOGIN, {"email": self.persona.email, "password": CLAVE}).data["desafio"]
        for _ in range(servicios_2fa.FALLOS_PERMITIDOS):
            self.post("/api/auth/2fa/verificar/", {"desafio": desafio, "codigo": "000000"})
        codigo = servicios_2fa.codigo_totp(clave, servicios_2fa.paso_actual() + 1)
        bloqueado = self.post("/api/auth/2fa/verificar/", {"desafio": desafio, "codigo": codigo})
        self.assertEqual(bloqueado.status_code, 429)

    def test_metodo_por_correo_completo(self):
        self.autenticar(self.persona)
        self.assertEqual(self.post("/api/auth/2fa/correo/iniciar/").status_code, 202)
        self.assertIn("activar la verificación", mail.outbox[-1].subject)
        # Reenvío inmediato: hay que esperar un minuto
        self.assertEqual(self.post("/api/auth/2fa/correo/iniciar/").status_code, 429)
        respuesta = self.post("/api/auth/2fa/correo/activar/", {"codigo": self.codigo_del_correo()})
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data["estado"]["metodo"], "correo")
        self.salir()

        enviados = len(mail.outbox)
        desafio = self.post(LOGIN, {"email": self.persona.email, "password": CLAVE})
        self.assertEqual(desafio.data["metodo"], "correo")
        self.assertEqual(len(mail.outbox), enviados + 1)
        self.assertIn("iniciar sesión", mail.outbox[-1].subject)
        ok = self.post("/api/auth/2fa/verificar/", {"desafio": desafio.data["desafio"], "codigo": self.codigo_del_correo()})
        self.assertEqual(ok.status_code, 200)
        self.assertIn("token", ok.data)

    def test_codigo_de_correo_vencido(self):
        self.autenticar(self.persona)
        self.post("/api/auth/2fa/correo/iniciar/")
        SegundoFactor.objects.filter(usuario=self.persona).update(codigo_vence=timezone.now() - timedelta(minutes=1))
        respuesta = self.post("/api/auth/2fa/correo/activar/", {"codigo": self.codigo_del_correo()})
        self.assertEqual(respuesta.data["codigo"], "codigo_vencido")

    def test_correo_sin_confirmar_no_puede_usar_ese_metodo(self):
        self.persona.correo_verificado = False
        self.persona.save()
        self.autenticar(self.persona)
        self.assertEqual(self.post("/api/auth/2fa/correo/iniciar/").status_code, 409)

    def test_reenviar_con_totp_no_aplica(self):
        self.activar_totp()
        desafio = self.post(LOGIN, {"email": self.persona.email, "password": CLAVE}).data["desafio"]
        self.assertEqual(self.post("/api/auth/2fa/reenviar/", {"desafio": desafio}).status_code, 409)

    def test_desactivar_y_regenerar_piden_contrasena(self):
        _, codigos = self.activar_totp()
        self.autenticar(self.persona)
        self.assertEqual(self.post("/api/auth/2fa/codigos-respaldo/", {"password": "mala"}).status_code, 400)
        nuevos = self.post("/api/auth/2fa/codigos-respaldo/", {"password": CLAVE}).data["codigos_respaldo"]
        self.assertNotEqual(set(nuevos), set(codigos))
        self.assertEqual(self.post("/api/auth/2fa/desactivar/", {"password": "mala"}).status_code, 400)
        respuesta = self.post("/api/auth/2fa/desactivar/", {"password": CLAVE})
        self.assertEqual(respuesta.status_code, 200)
        self.assertFalse(respuesta.data["activo"])
        self.assertFalse(SegundoFactor.objects.filter(usuario=self.persona).exists())
        self.assertIn("Desactivaste", mail.outbox[-1].subject)
        self.salir()
        self.assertIn("token", self.post(LOGIN, {"email": self.persona.email, "password": CLAVE}).data)

    def test_no_se_activa_dos_veces(self):
        self.activar_totp()
        self.autenticar(self.persona)
        self.assertEqual(self.post("/api/auth/2fa/correo/iniciar/").status_code, 409)

    def test_cuentas_demo_no_usan_2fa(self):
        self.autenticar(self.votante)  # votante@festival.test es de demostración
        respuesta = self.post("/api/auth/2fa/totp/iniciar/")
        self.assertEqual(respuesta.status_code, 403)
        self.assertEqual(respuesta.data["codigo"], "cuenta_demo")

    def test_requiere_sesion(self):
        self.assertEqual(self.client.get("/api/auth/2fa/").status_code, 401)


@override_settings(CORREO_ADAPTADOR="smtp", CORREO_EN_SEGUNDO_PLANO=False)
class QuitarDosPasosAdministracionTest(ConPersona, BaseAPITest):
    """R-11: la administración quita la 2FA de quien perdió el acceso, siempre con un motivo."""

    MOTIVO = "Perdió el celular; se verificó su identidad por llamada al número registrado."

    def ruta(self, usuario):
        return f"/api/gestion/usuarios/{usuario.pk}/quitar-2fa/"

    def test_admin_ve_quien_tiene_2fa_y_la_quita_con_motivo(self):
        self.activar_totp()
        self.autenticar(self.admin)
        fila = next(u for u in self.client.get("/api/gestion/usuarios/").data if u["id"] == self.persona.pk)
        self.assertEqual(fila["verificacion_dos_pasos"], "totp")
        respuesta = self.post(self.ruta(self.persona), {"motivo": self.MOTIVO})
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data["verificacion_dos_pasos"], "")
        self.assertFalse(servicios_2fa.activo(self.persona))
        registro = RegistroAuditoria.objects.get(accion="quitar_2fa")
        self.assertEqual(registro.detalle["motivo"], self.MOTIVO)
        self.assertIn("La administración quitó", mail.outbox[-1].subject)
        self.assertIn(self.MOTIVO, mail.outbox[-1].body)

    def test_sin_motivo_suficiente_no_se_quita(self):
        self.activar_totp()
        self.autenticar(self.admin)
        respuesta = self.post(self.ruta(self.persona), {"motivo": "porque sí"})
        self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(respuesta.data["codigo"], "motivo_requerido")
        self.assertTrue(servicios_2fa.activo(self.persona))

    def test_exige_el_permiso(self):
        self.activar_totp()
        self.autenticar(self.votante)
        self.assertEqual(self.post(self.ruta(self.persona), {"motivo": self.MOTIVO}).status_code, 403)
        self.assertTrue(servicios_2fa.activo(self.persona))

    def test_no_sobre_la_cuenta_propia(self):
        self.autenticar(self.admin)
        respuesta = self.post(self.ruta(self.admin), {"motivo": self.MOTIVO})
        self.assertEqual(respuesta.data["codigo"], "cuenta_propia")

    def test_cuenta_sin_2fa(self):
        self.autenticar(self.admin)
        self.assertEqual(self.post(self.ruta(self.persona), {"motivo": self.MOTIVO}).status_code, 409)
