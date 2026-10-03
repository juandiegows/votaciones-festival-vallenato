from abc import ABC, abstractmethod
from dataclasses import dataclass, field


class ErrorEnvioCorreo(Exception):
    """El proveedor no aceptó el mensaje (credenciales, red, remitente no verificado…)."""


@dataclass
class Destinatario:
    correo: str
    nombre: str = ""


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


class AdaptadorCorreo(ABC):
    """
    Contrato que cumple cada proveedor de correo. Para cambiar de proveedor se escribe otro adaptador y se registra
    en CORREO_ADAPTADORES (settings); el resto del sistema solo conoce servicio.enviar_*.
    """

    nombre = ""

    @abstractmethod
    def enviar(self, mensaje: Mensaje) -> None:
        """Envía el mensaje o lanza ErrorEnvioCorreo."""
