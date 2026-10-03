import secrets
import string

from django.db import transaction
from django.db.models import Count, Min, Q
from django.utils import timezone

from .models import Categoria, Edicion, Opcion, RegistroAuditoria, Votacion, Voto

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
            "La votación no está abierta.", codigo="votacion_no_abierta", status=409
        )

    try:
        opcion = votacion.opciones.get(pk=opcion_id, activa=True)
    except Opcion.DoesNotExist:
        raise ReglaNegocioError("La opción no pertenece a esta votación.", codigo="opcion_invalida")

    if votos_del_usuario(usuario, votacion) >= votacion.votos_por_usuario:
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
            "La votación necesita al menos dos opciones activas para publicarse.",
            codigo="opciones_insuficientes",
        )
    votacion.publicada = True
    votacion.save(update_fields=["publicada", "actualizada_en"])
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
    votacion.save(update_fields=["publicada", "actualizada_en"])
    return votacion


UMBRAL_PARTICIPACION = 10
MOTIVO_PARTICIPACION_OCULTA = (
    "La lista se muestra al cierre o al llegar a 10 votantes, para que no se pueda deducir el voto de las primeras personas."
)


def participacion(votacion):
    """
    Quién votó, nunca por qué opción. Para que no se pueda deducir el voto de nadie comparando la lista con los
    resultados en tiempo real, mientras la votación no cierra los votantes se revelan en bloques de 10 (según el
    orden de su primer voto) y la lista se ordena alfabéticamente, con la fecha sin hora.
    """
    primeros = list(
        Voto.objects.filter(votacion=votacion)
        .values("usuario_id", "usuario__nombres", "usuario__apellidos", "usuario__email")
        .annotate(primera=Min("fecha_hora"))
        .order_by("primera", "usuario_id")
    )
    total_votantes = len(primeros)
    estado = votacion.estado
    if estado == Votacion.Estado.CERRADA:
        visibles, motivo = primeros, ""
    elif total_votantes < UMBRAL_PARTICIPACION:
        visibles, motivo = [], MOTIVO_PARTICIPACION_OCULTA
    else:
        visibles = primeros[: total_votantes // UMBRAL_PARTICIPACION * UMBRAL_PARTICIPACION]
        motivo = "" if len(visibles) == total_votantes else (
            "Mientras la votación está abierta, los votantes se muestran en bloques de 10."
        )
    votantes = sorted(
        (
            {
                "usuario_id": f["usuario_id"],
                "nombres": f["usuario__nombres"],
                "apellidos": f["usuario__apellidos"],
                "email": f["usuario__email"],
                "fecha": timezone.localtime(f["primera"]).date(),
            }
            for f in visibles
        ),
        key=lambda v: (v["apellidos"].lower(), v["nombres"].lower(), v["usuario_id"]),
    )
    return {
        "votacion_id": votacion.id,
        "votacion": votacion.titulo,
        "estado": estado,
        "umbral": UMBRAL_PARTICIPACION,
        "total_votos": Voto.objects.filter(votacion=votacion).count(),
        "total_votantes": total_votantes,
        "disponible": estado == Votacion.Estado.CERRADA or total_votantes >= UMBRAL_PARTICIPACION,
        "motivo": motivo,
        "votantes": votantes,
        "ocultos": total_votantes - len(votantes),
    }


def resumen_edicion(edicion):
    """Votos por categoría → votación → opción de una edición (para el tablero de resultados)."""
    conteos = dict(
        Voto.objects.filter(votacion__categoria__edicion=edicion).values_list("opcion").annotate(total=Count("id"))
    )
    categorias = []
    total_edicion = 0
    consulta = Categoria.objects.filter(edicion=edicion).prefetch_related("votaciones__opciones").order_by("orden", "nombre")
    for categoria in consulta:
        votaciones = []
        for votacion in sorted(categoria.votaciones.all(), key=lambda v: (v.fecha_apertura, v.id)):
            opciones = [(o, conteos.get(o.id, 0)) for o in votacion.opciones.all()]
            total = sum(n for _, n in opciones)
            filas = [
                {"opcion_id": o.id, "nombre": o.nombre, "votos": n, "porcentaje": round(n * 100 / total, 2) if total else 0.0}
                for o, n in opciones
            ]
            filas.sort(key=lambda f: f["votos"], reverse=True)
            votaciones.append({
                "votacion_id": votacion.id, "titulo": votacion.titulo, "estado": votacion.estado,
                "publicada": votacion.publicada, "total_votos": total, "opciones": filas,
            })
        total_categoria = sum(v["total_votos"] for v in votaciones)
        total_edicion += total_categoria
        categorias.append({
            "categoria_id": categoria.id, "nombre": categoria.nombre, "icono": categoria.icono,
            "icono_imagen": categoria.icono_imagen.url if categoria.icono_imagen else None,
            "total_votos": total_categoria, "votaciones": votaciones,
        })
    return {"edicion_id": edicion.id, "edicion": edicion.nombre, "total_votos": total_edicion, "categorias": categorias}


def verificar_integridad(edicion):
    """Comprueba que los votos cuadren en cada votación de la edición (sin revelar quién votó por qué)."""
    filas = []
    votaciones = Votacion.objects.filter(categoria__edicion=edicion).select_related("categoria").order_by(
        "categoria__orden", "fecha_apertura", "id"
    )
    for votacion in votaciones:
        votos = Voto.objects.filter(votacion=votacion)
        total = votos.count()
        suma_por_opcion = Voto.objects.filter(opcion__votacion=votacion).count()
        votantes_unicos = votos.values("usuario").distinct().count()
        excedidos = (
            votos.values("usuario").annotate(n=Count("id")).filter(n__gt=votacion.votos_por_usuario).count()
        )
        ajena = votos.exclude(opcion__votacion=votacion).count()
        inactivos = votos.filter(opcion__votacion=votacion, opcion__activa=False).count()
        fuera = votos.filter(Q(fecha_hora__lt=votacion.fecha_apertura) | Q(fecha_hora__gt=votacion.fecha_cierre)).count()
        duplicados = votos.values("codigo_comprobante").annotate(n=Count("id")).filter(n__gt=1).count()
        alertas = []
        if suma_por_opcion != total:
            alertas.append(f"La suma por opción ({suma_por_opcion}) no coincide con el total de votos ({total}).")
        if excedidos:
            alertas.append(f"{excedidos} usuario(s) superan el límite de {votacion.votos_por_usuario} voto(s).")
        if ajena:
            alertas.append(f"{ajena} voto(s) apuntan a una opción de otra votación.")
        if inactivos:
            alertas.append(f"{inactivos} voto(s) son por una opción desactivada.")
        if fuera:
            alertas.append(f"{fuera} voto(s) se registraron fuera del periodo de la votación.")
        if duplicados:
            alertas.append(f"{duplicados} comprobante(s) repetido(s).")
        filas.append({
            "votacion_id": votacion.id, "titulo": votacion.titulo, "categoria": votacion.categoria.nombre,
            "estado": votacion.estado, "votos_por_usuario": votacion.votos_por_usuario, "total_votos": total,
            "suma_por_opcion": suma_por_opcion, "votantes_unicos": votantes_unicos, "usuarios_excedidos": excedidos,
            "votos_opcion_ajena": ajena, "votos_inactivos": inactivos, "votos_fuera_de_plazo": fuera,
            "comprobantes_duplicados": duplicados, "ok": not alertas, "alertas": alertas,
        })
    votos_edicion = Voto.objects.filter(votacion__categoria__edicion=edicion)
    con_alertas = sum(1 for f in filas if not f["ok"])
    return {
        "edicion_id": edicion.id,
        "edicion": edicion.nombre,
        "generado": timezone.now(),
        "ok": con_alertas == 0,
        "resumen": {
            "total_votos": votos_edicion.count(),
            "votantes_unicos": votos_edicion.values("usuario").distinct().count(),
            "votaciones": len(filas),
            "votaciones_con_alertas": con_alertas,
        },
        "votaciones": filas,
    }


def validar_eliminacion(objeto):
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
