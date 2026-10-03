import base64
import json
import urllib.error
import urllib.request

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

from .base import AdaptadorCorreo, ErrorEnvioCorreo, Mensaje


class AdaptadorZeptoMail(AdaptadorCorreo):
    """
    Envía con la API HTTP de ZeptoMail (Zoho): POST {ZEPTOMAIL_API_URL} con
    «Authorization: Zoho-enczapikey <token>». El token es el «Send Mail Token» del Mail Agent y el remitente
    (CORREO_REMITENTE) debe pertenecer a un dominio verificado en ese Mail Agent.
    Región: api.zeptomail.com (US), api.zeptomail.eu, api.zeptomail.in, api.zeptomail.com.au…
    """

    nombre = "zeptomail"

    def __init__(self):
        self.token = settings.ZEPTOMAIL_TOKEN
        self.url = settings.ZEPTOMAIL_API_URL
        self.timeout = settings.ZEPTOMAIL_TIMEOUT
        if not self.token:
            raise ImproperlyConfigured("CORREO_ADAPTADOR=zeptomail requiere ZEPTOMAIL_TOKEN.")
        # El token viaja en el encabezado: solo por HTTPS (urlopen también abriría file:// u otros esquemas)
        if not self.url.startswith("https://"):
            raise ImproperlyConfigured("ZEPTOMAIL_API_URL debe empezar por https://.")

    def cuerpo(self, mensaje: Mensaje) -> dict:
        datos = {
            "from": {"address": mensaje.remitente.correo, "name": mensaje.remitente.nombre},
            "to": [{"email_address": {"address": d.correo, "name": d.nombre}} for d in mensaje.para],
            "subject": mensaje.asunto,
            "htmlbody": mensaje.html,
            "textbody": mensaje.texto,
        }
        if mensaje.imagenes:
            datos["inline_images"] = [
                {"cid": i.cid, "mime_type": i.tipo, "name": i.nombre, "content": base64.b64encode(i.contenido).decode()}
                for i in mensaje.imagenes
            ]
        if mensaje.responder_a:
            datos["reply_to"] = [{"address": mensaje.responder_a}]
        if settings.ZEPTOMAIL_BOUNCE_ADDRESS:
            datos["bounce_address"] = settings.ZEPTOMAIL_BOUNCE_ADDRESS
        if mensaje.etiquetas:
            datos["client_reference"] = mensaje.etiquetas.get("plantilla", "")
        return datos

    def enviar(self, mensaje: Mensaje) -> None:
        token = self.token if self.token.startswith("Zoho-enczapikey") else f"Zoho-enczapikey {self.token}"
        peticion = urllib.request.Request(  # noqa: S310 (https validado en __init__)
            self.url,
            data=json.dumps(self.cuerpo(mensaje)).encode("utf-8"),
            headers={"Authorization": token, "Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(peticion, timeout=self.timeout) as respuesta:  # noqa: S310 (https validado)
                respuesta.read()
        except urllib.error.HTTPError as error:
            detalle = error.read().decode("utf-8", "replace")[:500]
            raise ErrorEnvioCorreo(f"ZeptoMail respondió {error.code}: {detalle}") from error
        except (urllib.error.URLError, TimeoutError) as error:
            raise ErrorEnvioCorreo(f"No se pudo conectar con ZeptoMail: {error}") from error
