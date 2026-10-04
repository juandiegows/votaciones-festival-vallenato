"""Escrituras del dominio con sus reglas de negocio (RN-xx). No conocen HTTP: reciben datos y lanzan ReglaNegocioError."""

import secrets
import string

from django.db import transaction

from ..comun.errores import ReglaNegocioError
from .models import Edicion, Opcion, Votacion, Voto
from .selectores import votos_del_usuario

ALFABETO_COMPROBANTE = string.ascii_uppercase + string.digits


def generar_codigo_comprobante(votacion):
    prefijo = f"FLV{votacion.categoria.edicion.anio % 100:02d}-"
    while True:
        codigo = prefijo + "".join(secrets.choice(ALFABETO_COMPROBANTE) for _ in range(6))
        if not Voto.objects.filter(codigo_comprobante=codigo).exists():
            return codigo


@transaction.atomic
def emitir_voto(usuario, votacion_id, opcion_id, ip=None):
    if not usuario.correo_verificado:
        raise ReglaNegocioError(
            "Confirma tu correo para poder votar. Revisa tu bandeja de entrada.", codigo="correo_sin_confirmar", status=403
        )
    from ..cuentas.servicios import falta_documento

    if falta_documento(usuario):
        raise ReglaNegocioError(
            "Completa tu tipo y número de documento para poder votar.", codigo="documento_requerido", status=403
        )

    votacion = Votacion.objects.select_for_update().select_related("categoria__edicion").get(pk=votacion_id)

    if votacion.estado != Votacion.Estado.ABIERTA:
        raise ReglaNegocioError(
            "La votación no está abierta.", codigo="votacion_no_abierta", status=409
        )

    if votacion.pausada:
        raise ReglaNegocioError(
            "Las votaciones están en pausa temporalmente. Intenta más tarde.", codigo="votaciones_pausadas", status=409
        )

    try:
        opcion = votacion.opciones.get(pk=opcion_id, activa=True)
    except Opcion.DoesNotExist:
        raise ReglaNegocioError("La opción no pertenece a esta votación.", codigo="opcion_invalida")

    if votos_del_usuario(usuario, votacion) >= votacion.votos_por_usuario_efectivo:
        raise ReglaNegocioError(
            "Ya alcanzaste el límite de votos de esta votación.", codigo="limite_votos", status=409
        )

    return Voto.objects.create(
        usuario=usuario,
        votacion=votacion,
        opcion=opcion,
        codigo_comprobante=generar_codigo_comprobante(votacion),
        ip=ip,
    )


def publicar_votacion(votacion):
    if votacion.opciones.filter(activa=True).count() < 2:
        raise ReglaNegocioError(
            "La votación necesita al menos dos opciones activas para publicarse.",
            codigo="opciones_insuficientes",
        )
    votacion.publicada = True
    votacion.save(update_fields=["publicada"])
    return votacion


def despublicar_votacion(votacion):
    """Retira la votación del sitio público; no se permite mientras está abierta (recibiendo votos)."""
    if votacion.estado == Votacion.Estado.ABIERTA:
        raise ReglaNegocioError(
            "No se puede despublicar una votación abierta: espera al cierre o ciérrala primero.",
            codigo="votacion_abierta",
            status=409,
        )
    votacion.publicada = False
    votacion.save(update_fields=["publicada"])
    return votacion


def cerrar_votacion(votacion):
    """Cierre anticipado: la votación deja de recibir votos aunque no haya llegado su fecha de cierre."""
    votacion.cerrada_manualmente = True
    votacion.save(update_fields=["cerrada_manualmente"])
    return votacion


def publicar_resultados_votacion(votacion, publicar):
    votacion.resultados_publicados = publicar
    votacion.save(update_fields=["resultados_publicados"])
    return votacion


def publicar_resultados_edicion(edicion, publicar):
    """Publica u oculta los resultados de todas las votaciones de la edición. Devuelve cuántas se actualizaron."""
    return Votacion.objects.filter(categoria__edicion=edicion).update(resultados_publicados=publicar)


def validar_eliminacion(objeto):
    """RN-09: una votación u opción con votos no se elimina; se cierra o se desactiva."""
    if objeto.votos.exists():
        raise ReglaNegocioError(
            "No se puede eliminar porque ya tiene votos; ciérrala o desactívala.",
            codigo="tiene_votos",
            status=409,
        )


def cerrar_otras_ediciones(edicion):
    """Mantiene una sola edición activa: si esta queda activa, las demás se cierran."""
    if edicion.estado != Edicion.Estado.ACTIVA:
        return 0
    return Edicion.objects.filter(estado=Edicion.Estado.ACTIVA).exclude(pk=edicion.pk).update(
        estado=Edicion.Estado.CERRADA
    )
