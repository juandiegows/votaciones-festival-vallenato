from .base import AdaptadorCorreo, Mensaje


class AdaptadorMemoria(AdaptadorCorreo):
    """Guarda los mensajes en una lista en lugar de enviarlos (vista previa de plantillas)."""

    nombre = "memoria"

    def __init__(self):
        self.mensajes: list[Mensaje] = []

    def enviar(self, mensaje: Mensaje) -> None:
        self.mensajes.append(mensaje)
