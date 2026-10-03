import json
import urllib.error
from io import BytesIO
from unittest import mock

from django.core import mail
from django.core.exceptions import ImproperlyConfigured
from django.test import override_settings

from votaciones import correo
from votaciones.correo.adaptadores import ErrorEnvioCorreo
from votaciones.models import Voto

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

    @override_settings(**ZEPTO)
    def test_fallo_del_proveedor(self):
        error = urllib.error.HTTPError("u", 401, "Unauthorized", {}, BytesIO(b'{"error":"invalid token"}'))
        with mock.patch("urllib.request.urlopen", side_effect=error):
            with self.assertLogs("votaciones.correo", "ERROR"):
                self.assertFalse(correo.enviar_bienvenida(self.votante))
            with self.assertRaisesMessage(ErrorEnvioCorreo, "401"):
                correo.enviar_bienvenida(self.votante, silencioso=False)
