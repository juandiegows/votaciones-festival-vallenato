from abc import ABC, abstractmethod
from dataclasses import dataclass, field


class ErrorEnvioCorreo(Exception):
    """El proveedor no aceptó el mensaje (credenciales, red, remitente no verificado…)."""


@dataclass
class Destinatario:
    correo: str
    nombre: str = ""


@dataclass
class ImagenEnLinea:
    """Imagen incrustada en el correo (se cita en el HTML como src="cid:<cid>"); se ve aunque el cliente
    bloquee las imágenes externas."""

    cid: str
    contenido: bytes
    tipo: str = "image/png"
    nombre: str = "imagen.png"


@dataclass
class Mensaje:
    """Correo ya renderizado, independiente del proveedor que lo envía."""

    para: list[Destinatario]
    asunto: str
    html: str
    texto: str
    remitente: Destinatario
    responder_a: str = ""
    etiquetas: dict = field(default_factory=dict)
    imagenes: list[ImagenEnLinea] = field(default_factory=list)


class AdaptadorCorreo(ABC):
    """
    Contrato que cumple cada proveedor de correo. Para cambiar de proveedor se escribe otro adaptador y se registra
    en CORREO_ADAPTADORES (settings); el resto del sistema solo conoce servicio.enviar_*.
    """

    nombre = ""

    @abstractmethod
    def enviar(self, mensaje: Mensaje) -> None:
        """Envía el mensaje o lanza ErrorEnvioCorreo."""
