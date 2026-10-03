import logging

from .base import AdaptadorCorreo, Mensaje

logger = logging.getLogger("votaciones.correo")


class AdaptadorConsola(AdaptadorCorreo):
    """Desarrollo: no envía nada, escribe el correo (versión texto) en el log/terminal."""

    nombre = "consola"

    def enviar(self, mensaje: Mensaje) -> None:
        para = ", ".join(d.correo for d in mensaje.para)
        logger.warning("Correo (consola) → %s | %s\n%s", para, mensaje.asunto, mensaje.texto)
