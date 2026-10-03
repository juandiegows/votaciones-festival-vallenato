"""
Identidad del votante: documento único y confirmación del correo (una persona = una cuenta que puede votar).
El enlace de confirmación lleva un token firmado con SECRET_KEY que vence en CORREO_CONFIRMACION_HORAS e incluye el
correo: si la cuenta cambia de correo, los enlaces anteriores dejan de servir.
"""

import re

from django.conf import settings
from django.core import signing

from . import correo
from .models import Usuario

SAL_CONFIRMACION = "votaciones.confirmar-correo"

# Formato por tipo de documento (Colombia). Cédula y tarjeta: solo dígitos; los demás admiten letras.
FORMATO_DOCUMENTO = {
    Usuario.TipoDocumento.CC: (r"\d{5,10}", "La cédula de ciudadanía tiene entre 5 y 10 dígitos."),
    Usuario.TipoDocumento.TI: (r"\d{8,11}", "La tarjeta de identidad tiene entre 8 y 11 dígitos."),
    Usuario.TipoDocumento.CE: (r"[A-Z0-9]{4,12}", "La cédula de extranjería tiene entre 4 y 12 letras o números."),
    Usuario.TipoDocumento.PA: (r"[A-Z0-9]{5,15}", "El pasaporte tiene entre 5 y 15 letras o números."),
    Usuario.TipoDocumento.PPT: (r"[A-Z0-9]{5,15}", "El PPT tiene entre 5 y 15 letras o números."),
}


class TokenInvalido(Exception):
    def __init__(self, mensaje, codigo):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.codigo = codigo


def normalizar_documento(numero):
    """Quita puntos, guiones y espacios («1.065.123.456» → «1065123456») y pasa a mayúsculas."""
    return re.sub(r"[^0-9A-Za-z]", "", numero or "").upper()


def error_formato_documento(tipo, numero):
    patron, mensaje = FORMATO_DOCUMENTO.get(tipo, (None, None))
    if patron and not re.fullmatch(patron, numero):
        return mensaje
    return None


def token_confirmacion(usuario):
    return signing.dumps({"u": usuario.pk, "e": usuario.email}, salt=SAL_CONFIRMACION, compress=True)


def enlace_confirmacion(usuario):
    return f"{correo.servicio.url_sitio()}/confirmar-correo?token={token_confirmacion(usuario)}"


def enviar_confirmacion(usuario):
    """Programa el correo de confirmación para cuando el registro quede guardado."""
    correo.enviar_al_confirmar(
        correo.enviar_confirmacion_correo, usuario, enlace_confirmacion(usuario),
        horas_validez=settings.CORREO_CONFIRMACION_HORAS,
    )


def confirmar_correo(token):
    """Valida el token y marca el correo como verificado. Devuelve (usuario, recien_confirmado)."""
    try:
        datos = signing.loads(token, salt=SAL_CONFIRMACION, max_age=settings.CORREO_CONFIRMACION_HORAS * 3600)
    except signing.SignatureExpired:
        raise TokenInvalido("El enlace de confirmación venció. Pide uno nuevo desde tu cuenta.", "token_vencido")
    except signing.BadSignature:
        raise TokenInvalido("El enlace de confirmación no es válido.", "token_invalido")
    usuario = Usuario.objects.filter(pk=datos.get("u"), email=datos.get("e"), is_active=True).first()
    if usuario is None:
        raise TokenInvalido("El enlace de confirmación no es válido.", "token_invalido")
    if usuario.correo_verificado:
        return usuario, False
    usuario.correo_verificado = True
    usuario.save(update_fields=["correo_verificado"])
    correo.enviar_al_confirmar(correo.enviar_bienvenida, usuario)
    return usuario, True
