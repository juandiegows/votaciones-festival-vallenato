import secrets
import string

from django.db import transaction
from django.db.models import Count

from .models import Opcion, RegistroAuditoria, Votacion, Voto

ALFABETO_COMPROBANTE = string.ascii_uppercase + string.digits


class ReglaNegocioError(Exception):
    def __init__(self, mensaje, codigo="regla_negocio", status=400):
        super().__init__(mensaje)
        self.mensaje = mensaje
        self.codigo = codigo
        self.status = status


def ip_cliente(request):
    reenviada = request.META.get("HTTP_X_FORWARDED_FOR")
    if reenviada:
        return reenviada.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def auditar(request, accion, entidad, entidad_id="", detalle=None):
    usuario = request.user if request.user.is_authenticated else None
    return RegistroAuditoria.objects.create(
        usuario=usuario,
        accion=accion,
        entidad=entidad,
        entidad_id=str(entidad_id),
        detalle=detalle or {},
        ip=ip_cliente(request),
    )


def generar_codigo_comprobante(votacion):
    prefijo = f"FLV{votacion.categoria.edicion.anio % 100:02d}-"
    while True:
        codigo = prefijo + "".join(secrets.choice(ALFABETO_COMPROBANTE) for _ in range(6))
        if not Voto.objects.filter(codigo_comprobante=codigo).exists():
            return codigo


def votos_del_usuario(usuario, votacion):
    if not usuario.is_authenticated:
        return 0
    return Voto.objects.filter(usuario=usuario, votacion=votacion).count()


@transaction.atomic
def emitir_voto(usuario, votacion_id, opcion_id, ip=None):
    votacion = Votacion.objects.select_for_update().select_related("categoria__edicion").get(pk=votacion_id)

    if votacion.estado != Votacion.Estado.ABIERTA:
        raise ReglaNegocioError(
            "La votación no está abierta (RN-03).", codigo="votacion_no_abierta", status=409
        )

    try:
        opcion = votacion.opciones.get(pk=opcion_id, activa=True)
    except Opcion.DoesNotExist:
        raise ReglaNegocioError("La opción no pertenece a esta votación.", codigo="opcion_invalida")

    if votos_del_usuario(usuario, votacion) >= votacion.votos_por_usuario:
        raise ReglaNegocioError(
            "Ya alcanzaste el límite de votos de esta votación (RN-04).", codigo="limite_votos", status=409
        )

    return Voto.objects.create(
        usuario=usuario,
        votacion=votacion,
        opcion=opcion,
        codigo_comprobante=generar_codigo_comprobante(votacion),
        ip=ip,
    )


def resultados_visibles_para(votacion, usuario):
    if usuario.is_authenticated and usuario.es_administrador:
        return True
    if not votacion.publicada:
        return False
    if votacion.resultados_publicados:
        return True
    if votacion.visibilidad_resultados == Votacion.Visibilidad.TIEMPO_REAL:
        return True
    if votacion.visibilidad_resultados == Votacion.Visibilidad.AL_CIERRE:
        return votacion.estado == Votacion.Estado.CERRADA
    return False


def calcular_resultados(votacion):
    conteos = dict(
        Voto.objects.filter(votacion=votacion).values_list("opcion").annotate(total=Count("id"))
    )
    total = sum(conteos.values())
    filas = []
    for opcion in votacion.opciones.all():
        votos = conteos.get(opcion.id, 0)
        filas.append(
            {
                "opcion_id": opcion.id,
                "opcion": opcion.nombre,
                "votos": votos,
                "porcentaje": round(votos * 100 / total, 2) if total else 0.0,
            }
        )
    filas.sort(key=lambda f: f["votos"], reverse=True)
    return {
        "votacion_id": votacion.id,
        "votacion": votacion.titulo,
        "estado": votacion.estado,
        "total_votos": total,
        "resultados": filas,
    }


def publicar_votacion(votacion):
    if votacion.opciones.filter(activa=True).count() < 2:
        raise ReglaNegocioError(
            "La votación necesita al menos dos opciones activas para publicarse (RN-06).",
            codigo="opciones_insuficientes",
        )
    votacion.publicada = True
    votacion.save(update_fields=["publicada", "actualizada_en"])
    return votacion


def validar_eliminacion(objeto):
    if objeto.votos.exists():
        raise ReglaNegocioError(
            "No se puede eliminar porque ya tiene votos; ciérrala o desactívala (RN-09).",
            codigo="tiene_votos",
            status=409,
        )
