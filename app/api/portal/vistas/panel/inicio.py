"""Inicio del panel: indicadores de la edición, actividad reciente y votaciones abiertas."""

from django.db.models import Count

from votaciones.auditoria.models import RegistroAuditoria
from votaciones.models import Edicion, Usuario, Votacion
from votaciones.votacion import selectores

from .base import ENTIDADES, edicion_panel, render_panel, solo_administrador

ACCIONES = {
    "crear": "Creó", "actualizar": "Actualizó", "eliminar": "Eliminó", "publicar": "Publicó", "despublicar": "Despublicó",
    "cerrar": "Cerró", "activar": "Activó", "desactivar": "Desactivó", "publicar_resultados": "Cambió los resultados de",
    "exportar_resultados": "Exportó los resultados de",
}


def describir(registro):
    """«Creó la categoría «Música»» a partir de un registro de auditoría."""
    detalle = registro.detalle if isinstance(registro.detalle, dict) else {}
    nombre = detalle.get("nombre") or detalle.get("titulo")
    accion = ACCIONES.get(registro.accion, registro.accion.replace("_", " ").capitalize())
    entidad = ENTIDADES.get(registro.entidad, (registro.entidad.replace("_", " "),))[0]
    sufijo = f" «{nombre}»" if nombre else (f" #{registro.entidad_id}" if registro.entidad_id else "")
    return f"{accion} {entidad}{sufijo}"


def actividad_reciente(limite=8):
    registros = RegistroAuditoria.objects.select_related("usuario").order_by("-fecha_hora")[:limite]
    return [{"texto": describir(r), "fecha": r.fecha_hora, "usuario": r.usuario.email if r.usuario else "Sistema"}
            for r in registros]


def indicadores(edicion, votaciones, abiertas):
    categorias = edicion.categorias.filter(activa=True).count() if edicion else 0
    return [
        {"etiqueta": "Votaciones abiertas", "valor": len(abiertas), "icono": "unlock", "clase": ""},
        {"etiqueta": "Votos de la edición", "valor": sum(v.num_votos for v in votaciones), "icono": "check2-all", "clase": "oro"},
        {"etiqueta": "Votantes registrados", "valor": Usuario.objects.filter(rol=Usuario.Rol.VOTANTE).count(),
         "icono": "people", "clase": "terracota"},
        {"etiqueta": "Categorías activas", "valor": categorias, "icono": "grid", "clase": "oscuro"},
    ]


@solo_administrador
def inicio(request):
    edicion = edicion_panel(request)
    votaciones = list(
        Votacion.objects.filter(categoria__edicion=edicion).select_related("categoria__edicion").annotate(num_votos=Count("votos"))
    )
    abiertas = [v for v in votaciones if v.publicada and v.estado == Votacion.Estado.ABIERTA]
    return render_panel(request, "portal/panel/inicio.html", "inicio", edicion, {
        "kpis": indicadores(edicion, votaciones, abiertas),
        "abiertas": abiertas,
        "actividad": actividad_reciente(),
        "es_activa": edicion is not None and edicion.estado == Edicion.Estado.ACTIVA,
        "edicion_activa_real": selectores.edicion_activa(),
    })
