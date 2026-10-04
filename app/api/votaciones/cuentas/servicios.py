"""
Identidad del votante: registro, sesión por token y confirmación del correo (una persona = una cuenta que puede votar).
El enlace de confirmación lleva un token firmado con SECRET_KEY que vence en CORREO_CONFIRMACION_HORAS e incluye el
correo: si la cuenta cambia de correo, los enlaces anteriores dejan de servir.
"""

from django.conf import settings
from django.core import signing
from django.db import transaction
from rest_framework.authtoken.models import Token

from .. import correo
from ..comun.errores import ReglaNegocioError
from .models import Usuario

SAL_CONFIRMACION = "votaciones.confirmar-correo"


class TokenInvalido(ReglaNegocioError):
    def __init__(self, mensaje, codigo):
        super().__init__(mensaje, codigo=codigo, status=400)


@transaction.atomic
def registrar_votante(**datos):
    """Crea la cuenta y programa el correo de confirmación; la bienvenida sale cuando confirme el correo."""
    usuario = Usuario.objects.create_user(**datos)
    enviar_confirmacion(usuario)
    return usuario


def completar_documento(usuario, tipo_documento, numero_documento):
    """Registra el documento de quien no lo tenía; una vez guardado no se cambia desde la web."""
    if usuario.numero_documento:
        raise ReglaNegocioError("Tu documento ya está registrado.", codigo="documento_ya_registrado", status=409)
    usuario.tipo_documento, usuario.numero_documento = tipo_documento, numero_documento
    usuario.save(update_fields=["tipo_documento", "numero_documento"])
    return usuario


def falta_documento(usuario):
    """True si la administración pide documento y esta cuenta aún no lo tiene (no puede votar hasta completarlo)."""
    from ..sitio.models import ConfiguracionSitio

    return not usuario.numero_documento and ConfiguracionSitio.obtener().pedir_documento


def token_sesion(usuario):
    return Token.objects.get_or_create(user=usuario)[0].key


def cerrar_sesion(usuario):
    Token.objects.filter(user=usuario).delete()


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


def reenviar_confirmacion(usuario):
    if usuario.correo_verificado:
        raise ReglaNegocioError("Tu correo ya está confirmado.", codigo="correo_ya_confirmado", status=409)
    enviar_confirmacion(usuario)


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
