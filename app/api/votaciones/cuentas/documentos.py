"""Formato del documento de identidad (Colombia). Cédula y tarjeta: solo dígitos; los demás admiten letras."""

import re

from .models import Usuario

FORMATO_DOCUMENTO = {
    Usuario.TipoDocumento.CC: (r"\d{5,10}", "La cédula de ciudadanía tiene entre 5 y 10 dígitos."),
    Usuario.TipoDocumento.TI: (r"\d{8,11}", "La tarjeta de identidad tiene entre 8 y 11 dígitos."),
    Usuario.TipoDocumento.CE: (r"[A-Z0-9]{4,12}", "La cédula de extranjería tiene entre 4 y 12 letras o números."),
    Usuario.TipoDocumento.PA: (r"[A-Z0-9]{5,15}", "El pasaporte tiene entre 5 y 15 letras o números."),
    Usuario.TipoDocumento.PPT: (r"[A-Z0-9]{5,15}", "El PPT tiene entre 5 y 15 letras o números."),
}


def normalizar_documento(numero):
    """Quita puntos, guiones y espacios («1.065.123.456» → «1065123456») y pasa a mayúsculas."""
    return re.sub(r"[^0-9A-Za-z]", "", numero or "").upper()


def error_formato_documento(tipo, numero):
    patron, mensaje = FORMATO_DOCUMENTO.get(tipo, (None, None))
    if patron and not re.fullmatch(patron, numero):
        return mensaje
    return None
