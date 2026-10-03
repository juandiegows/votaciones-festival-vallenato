from email.utils import formataddr

from django.core.mail import EmailMultiAlternatives, get_connection

from .base import AdaptadorCorreo, ErrorEnvioCorreo, Mensaje


class AdaptadorSMTP(AdaptadorCorreo):
    """
    Envía por SMTP con el backend de Django (EMAIL_HOST, EMAIL_PORT, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD,
    EMAIL_USE_TLS / EMAIL_USE_SSL). Sirve para Gmail, Outlook, Zoho Mail, Mailtrap o el SMTP de ZeptoMail.
    En las pruebas Django cambia el backend por locmem, así que los correos quedan en django.core.mail.outbox.
    """

    nombre = "smtp"

    def enviar(self, mensaje: Mensaje) -> None:
        correo = EmailMultiAlternatives(
            subject=mensaje.asunto,
            body=mensaje.texto,
            from_email=formataddr((mensaje.remitente.nombre, mensaje.remitente.correo)),
            to=[formataddr((d.nombre, d.correo)) for d in mensaje.para],
            reply_to=[mensaje.responder_a] if mensaje.responder_a else None,
            connection=get_connection(fail_silently=False),
        )
        correo.attach_alternative(mensaje.html, "text/html")
        try:
            correo.send()
        except Exception as error:  # smtplib, socket y ssl lanzan excepciones distintas
            raise ErrorEnvioCorreo(f"SMTP rechazó el correo: {error}") from error
