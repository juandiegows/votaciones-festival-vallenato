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
from . import permisos as catalogo
from .models import Rol, Usuario

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


def _exige_permisos_de(actor, permisos, accion):
    """Nadie reparte permisos que no tiene: evita que un rol delegado se dé más acceso del que posee."""
    faltan = sorted(set(permisos) - set(actor.permisos))
    if faltan:
        raise ReglaNegocioError(
            f"No puedes {accion}: incluye permisos que tu rol no tiene ({', '.join(faltan)}).", codigo="permisos_insuficientes",
            status=403,
        )


def rol_o_error(codigo):
    rol = Rol.objects.filter(codigo=codigo).first()
    if rol is None:
        raise ReglaNegocioError(f"Rol no válido: «{codigo}» no existe.", codigo="rol_invalido")
    return rol


def cambiar_rol(actor, usuario, codigo):
    """
    Asigna un rol a un usuario. Reglas:
      - nadie cambia su propio rol (evita quedar fuera del panel o subirse de nivel);
      - solo se asigna (o se quita) un rol cuyos permisos tenga quien hace el cambio;
      - siempre queda al menos un administrador activo;
      - una cuenta desactivada no recibe un rol con acceso al panel.
    """
    nuevo = rol_o_error(codigo)
    if usuario.rol == nuevo.codigo:
        return usuario
    if usuario.pk == actor.pk:
        raise ReglaNegocioError("No puedes cambiar tu propio rol: pídeselo a otro administrador.")
    actual = Rol.objects.filter(codigo=usuario.rol).first()
    _exige_permisos_de(actor, nuevo.permisos_efectivos, f"asignar el rol «{nuevo.nombre}»")
    if actual:
        _exige_permisos_de(actor, actual.permisos_efectivos, f"quitar el rol «{actual.nombre}»")
    if usuario.rol == Usuario.Rol.ADMINISTRADOR:
        otros = Usuario.objects.filter(rol=Usuario.Rol.ADMINISTRADOR, is_active=True).exclude(pk=usuario.pk)
        if not otros.exists():
            raise ReglaNegocioError("Debe quedar al menos un administrador activo.")
    if not usuario.is_active and "panel.ver" in nuevo.permisos_efectivos:
        raise ReglaNegocioError("La cuenta está desactivada: actívala antes de darle acceso al panel.")
    usuario.rol = nuevo.codigo
    usuario.save(update_fields=["rol"])
    usuario.refrescar_permisos()
    return usuario


def guardar_rol(actor, datos, rol=None):
    """
    Crea un rol o cambia su nombre, descripción y permisos. Votante y administrador no cambian de permisos; nadie
    edita el rol que tiene ni marca permisos que no posee.
    """
    permisos = catalogo.validos(datos.get("permisos", rol.permisos if rol else []))
    if rol is not None:
        if rol.codigo == actor.rol:
            raise ReglaNegocioError("No puedes editar tu propio rol: pídeselo a otro administrador.", status=403)
        if rol.es_fijo and set(permisos) != set(rol.permisos_efectivos):
            raise ReglaNegocioError(f"Los permisos del rol «{rol.nombre}» son fijos.", codigo="rol_fijo")
        # Solo se exigen los permisos que cambian (los que ya estaban no los reparte quien edita)
        _exige_permisos_de(actor, set(permisos) ^ set(rol.permisos_efectivos), f"cambiar los permisos de «{rol.nombre}»")
    else:
        _exige_permisos_de(actor, permisos, "crear este rol")
        rol = Rol(codigo=datos["codigo"], sistema=False)
    rol.nombre = datos.get("nombre", rol.nombre)
    rol.descripcion = datos.get("descripcion", rol.descripcion)
    rol.orden = datos.get("orden", rol.orden)
    if not rol.es_fijo:
        rol.permisos = permisos
    rol.save()
    return rol


def eliminar_rol(actor, rol):
    if rol.sistema:
        raise ReglaNegocioError(f"«{rol.nombre}» es un rol del sistema: no se elimina.", codigo="rol_sistema")
    _exige_permisos_de(actor, rol.permisos_efectivos, f"eliminar el rol «{rol.nombre}»")
    usuarios = Usuario.objects.filter(rol=rol.codigo).count()
    if usuarios:
        raise ReglaNegocioError(f"«{rol.nombre}» tiene {usuarios} usuario(s): asígnales otro rol antes de eliminarlo.",
                                codigo="rol_con_usuarios", status=409)
    rol.delete()
