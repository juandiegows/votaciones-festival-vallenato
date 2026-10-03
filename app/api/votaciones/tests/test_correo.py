import json
import urllib.error
from io import BytesIO
from unittest import mock

from django.core import mail
from django.core.exceptions import ImproperlyConfigured
from django.test import override_settings

from votaciones import correo
from votaciones.correo.adaptadores import ErrorEnvioCorreo
from votaciones.models import Usuario, Voto

from .base import BaseAPITest

SMTP = {"CORREO_ADAPTADOR": "smtp", "CORREO_URL_SITIO": "https://votaciones.test/"}
ZEPTO = {
    "CORREO_ADAPTADOR": "zeptomail", "ZEPTOMAIL_TOKEN": "abc123", "CORREO_RESPONDER_A": "",
    "ZEPTOMAIL_API_URL": "https://api.zeptomail.test/v1.1/email", "ZEPTOMAIL_BOUNCE_ADDRESS": "",
}


@override_settings(**SMTP)
class PlantillasCorreoTest(BaseAPITest):
    def voto(self):
        return Voto.objects.create(
            usuario=self.votante, votacion=self.abierta, opcion=self.opcion_a, codigo_comprobante="FLV27-ABC123"
        )

    def ultimo(self):
        self.assertEqual(len(mail.outbox), 1)
        mensaje = mail.outbox[0]
        html, tipo = mensaje.alternatives[0]
        self.assertEqual(tipo, "text/html")
        self.assertEqual(mensaje.to, ["Valentina Prueba <votante@festival.test>"])
        return mensaje, html

    def test_bienvenida(self):
        self.assertTrue(correo.enviar_bienvenida(self.votante))
        mensaje, html = self.ultimo()
        self.assertIn("bienvenida", mensaje.subject)
        self.assertIn("¡Te damos la bienvenida, Valentina!", html)
        self.assertIn('href="https://votaciones.test"', html)
        self.assertIn("https://votaciones.test", mensaje.body)

    def test_confirmar_correo(self):
        correo.enviar_confirmacion_correo(self.votante, "https://votaciones.test/confirmar?t=x&u=1", horas_validez=24)
        mensaje, html = self.ultimo()
        self.assertIn("Confirma tu correo", mensaje.subject)
        self.assertIn("https://votaciones.test/confirmar?t=x&amp;u=1", html)
        self.assertIn("https://votaciones.test/confirmar?t=x&u=1", mensaje.body)
        self.assertIn("24 horas", mensaje.body)

    def test_comprobante_voto(self):
        correo.enviar_comprobante_voto(self.voto())
        mensaje, html = self.ultimo()
        self.assertIn("FLV27-ABC123", mensaje.subject)
        for texto in ("FLV27-ABC123", "Canción A", "Canción favorita del público", "Música", "/mis-votos", "/comprobante?imprimir=1"):
            self.assertIn(texto, html)
            self.assertIn(texto, mensaje.body)

    def test_restablecer_clave(self):
        correo.enviar_restablecer_clave(self.votante, "https://votaciones.test/clave/nueva?t=y", minutos_validez=30)
        mensaje, html = self.ultimo()
        self.assertIn("contraseña", mensaje.subject)
        self.assertIn("30 minutos", html)
        self.assertIn("https://votaciones.test/clave/nueva?t=y", mensaje.body)

    def test_logo_incrustado(self):
        correo.enviar_bienvenida(self.votante)
        mensaje = mail.outbox[0]
        self.assertIn('src="cid:logo-flv"', mensaje.alternatives[0][0])
        crudo = mensaje.message()
        self.assertEqual(crudo.get_content_subtype(), "related")
        imagen = [p for p in crudo.walk() if p.get_content_type() == "image/png"][0]
        self.assertEqual(imagen["Content-ID"], "<logo-flv>")
        self.assertTrue(imagen.get_payload(decode=True).startswith(b"\x89PNG"))

    def test_escapa_datos_del_usuario(self):
        self.votante.nombres = "<script>x</script>"
        correo.enviar_bienvenida(self.votante)
        html = mail.outbox[0].alternatives[0][0]
        self.assertNotIn("<script>x</script>", html)
        self.assertIn("&lt;script&gt;", html)


class AdaptadoresCorreoTest(BaseAPITest):
    @override_settings(CORREO_ADAPTADOR="no-existe")
    def test_adaptador_desconocido(self):
        with self.assertRaises(ImproperlyConfigured):
            correo.obtener_adaptador()

    @override_settings(CORREO_ADAPTADOR="zeptomail", ZEPTOMAIL_TOKEN="")
    def test_zeptomail_sin_token(self):
        with self.assertRaises(ImproperlyConfigured):
            correo.obtener_adaptador()

    @override_settings(**ZEPTO)
    def test_zeptomail_envia_por_api(self):
        respuesta = mock.MagicMock()
        respuesta.__enter__.return_value.read.return_value = b'{"data": []}'
        with mock.patch("urllib.request.urlopen", return_value=respuesta) as urlopen:
            self.assertTrue(correo.enviar_bienvenida(self.votante))
        peticion = urlopen.call_args.args[0]
        self.assertEqual(peticion.full_url, "https://api.zeptomail.test/v1.1/email")
        self.assertEqual(peticion.get_header("Authorization"), "Zoho-enczapikey abc123")
        cuerpo = json.loads(peticion.data)
        self.assertEqual(cuerpo["to"][0]["email_address"], {"address": "votante@festival.test", "name": "Valentina Prueba"})
        self.assertIn("¡Te damos la bienvenida, Valentina!", cuerpo["htmlbody"])
        self.assertIn("Valentina", cuerpo["textbody"])
        self.assertEqual(cuerpo["inline_images"][0]["cid"], "logo-flv")
        self.assertEqual(cuerpo["inline_images"][0]["mime_type"], "image/png")
        self.assertIn('src="cid:logo-flv"', cuerpo["htmlbody"])

    @override_settings(**ZEPTO)
    def test_fallo_del_proveedor(self):
        error = urllib.error.HTTPError("u", 401, "Unauthorized", {}, BytesIO(b'{"error":"invalid token"}'))
        with mock.patch("urllib.request.urlopen", side_effect=error):
            with self.assertLogs("votaciones.correo", "ERROR"):
                self.assertFalse(correo.enviar_bienvenida(self.votante))
            with self.assertRaisesMessage(ErrorEnvioCorreo, "401"):
                correo.enviar_bienvenida(self.votante, silencioso=False)


@override_settings(CORREO_ADAPTADOR="smtp", CORREO_EN_SEGUNDO_PLANO=False)
class CorreosEnFlujosTest(BaseAPITest):
    REGISTRO = {
        "email": "nuevo@festival.test", "nombres": "Carlos", "apellidos": "Pérez",
        "password": "Clave-Segura-2027", "acepta_tratamiento_datos": True,
    }

    def registrar(self, **cambios):
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post("/api/auth/registro/", {**self.REGISTRO, **cambios}, format="json")

    def votar(self, votacion, opcion):
        with self.captureOnCommitCallbacks(execute=True):
            return self.client.post(f"/api/votaciones/{votacion.pk}/votar/", {"opcion": opcion.pk}, format="json")

    def test_registro_envia_bienvenida(self):
        self.assertEqual(self.registrar().status_code, 201)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("bienvenida", mail.outbox[0].subject)
        self.assertTrue(mail.outbox[0].to[0].endswith("<nuevo@festival.test>"))

    def test_registro_invalido_no_envia(self):
        self.assertEqual(self.registrar(acepta_tratamiento_datos=False).status_code, 400)
        self.assertEqual(mail.outbox, [])

    def test_voto_envia_comprobante(self):
        self.autenticar(self.votante)
        respuesta = self.votar(self.abierta, self.opcion_a)
        self.assertEqual(respuesta.status_code, 201)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(respuesta.data["codigo_comprobante"], mail.outbox[0].subject)
        self.assertIn("Canción A", mail.outbox[0].body)

    def test_voto_rechazado_no_envia(self):
        self.autenticar(self.votante)
        self.votar(self.abierta, self.opcion_a)
        mail.outbox.clear()
        self.assertEqual(self.votar(self.abierta, self.opcion_b).status_code, 409)
        self.assertEqual(mail.outbox, [])

    def test_fallo_del_correo_no_afecta_el_registro(self):
        with mock.patch("votaciones.correo.servicio.render_to_string", side_effect=RuntimeError("plantilla rota")):
            with self.assertLogs("votaciones.correo", "ERROR"):
                respuesta = self.registrar()
        self.assertEqual(respuesta.status_code, 201)
        self.assertTrue(Usuario.objects.filter(email="nuevo@festival.test").exists())

    @override_settings(CORREO_EN_SEGUNDO_PLANO=True)
    def test_entrega_en_segundo_plano(self):
        with mock.patch("votaciones.correo.servicio.threading.Thread") as hilo:
            self.registrar()
        hilo.return_value.start.assert_called_once()
        self.assertEqual(hilo.call_args.kwargs["args"][2], "bienvenida")
