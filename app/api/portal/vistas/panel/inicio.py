"""Inicio del panel: indicadores, ruta de trabajo, lo que requiere atención, actividad y votaciones abiertas."""

from django.db.models import Count, Q
from django.urls import reverse

from votaciones.auditoria.models import RegistroAuditoria
from votaciones.models import Edicion, Usuario, Votacion
from votaciones.votacion import selectores

from .base import ENTIDADES, edicion_panel, render_panel, requiere_permiso

ACCIONES = {
    "crear": "Creó", "actualizar": "Actualizó", "eliminar": "Eliminó", "publicar": "Publicó", "despublicar": "Despublicó",
    "cerrar": "Cerró", "activar": "Activó", "desactivar": "Desactivó", "publicar_resultados": "Cambió los resultados de",
    "exportar_resultados": "Exportó los resultados de",
}
OPCIONES_MINIMAS = 2


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


def con_permiso(usuario, filas):
    """Quita las filas cuyo `permiso` no tiene el rol y el enlace de las que piden `permiso_url` para su acción."""
    visibles = []
    for fila in filas:
        if not usuario.tiene_permiso(fila.pop("permiso", "panel.ver")):
            continue
        if not usuario.tiene_permiso(fila.pop("permiso_url", "panel.ver")):
            fila["url"] = ""
        visibles.append(fila)
    return visibles


def indicadores(categorias, votaciones, abiertas):
    return [
        {"etiqueta": "Votaciones abiertas", "valor": len(abiertas), "icono": "unlock", "clase": "", "permiso": "votaciones.ver",
         "url": f"{reverse('portal:panel-votaciones')}?estado=abierta"},
        {"etiqueta": "Votos de la edición", "valor": sum(v.num_votos for v in votaciones), "icono": "check2-all", "clase": "oro",
         "permiso": "resultados.ver", "url": reverse("portal:panel-votos")},
        {"etiqueta": "Votantes registrados", "valor": Usuario.objects.filter(rol=Usuario.Rol.VOTANTE).count(),
         "icono": "people", "clase": "terracota", "permiso": "usuarios.ver", "url": ""},
        {"etiqueta": "Categorías activas", "valor": sum(1 for c in categorias if c.activa), "icono": "grid", "clase": "oscuro",
         "permiso": "categorias.ver", "url": reverse("portal:panel-categorias")},
    ]


def contar(total, singular, plural):
    return f"{total} {singular if total == 1 else plural}"


def ruta_trabajo(edicion, categorias, votaciones):
    """Los pasos para dejar una edición lista para el público, con su avance real."""
    activas = sum(1 for c in categorias if c.activa)
    publicadas = sum(1 for v in votaciones if v.publicada)
    return [
        {"titulo": "Edición", "detalle": edicion.nombre if edicion else "Crea la primera",
         "lista": edicion is not None, "url": reverse("portal:panel-ediciones"), "permiso_url": "ediciones.ver"},
        {"titulo": "Categorías", "detalle": contar(activas, "activa", "activas"),
         "lista": activas > 0, "url": reverse("portal:panel-categorias"), "permiso_url": "categorias.ver"},
        {"titulo": "Votaciones", "detalle": contar(len(votaciones), "creada", "creadas"),
         "lista": len(votaciones) > 0, "url": reverse("portal:panel-votaciones"), "permiso_url": "votaciones.ver"},
        {"titulo": "Opciones y publicación", "detalle": f"{publicadas} de {len(votaciones)} publicadas",
         "lista": len(votaciones) > 0 and publicadas == len(votaciones), "url": reverse("portal:panel-votaciones"),
         "permiso_url": "votaciones.ver"},
    ]


def pendientes_de(edicion, categorias, votaciones, hay_activa):
    """Lo que requiere atención, con el enlace para resolverlo (`permiso_url`: el permiso que pide esa acción)."""
    if edicion is None:
        return [{"icono": "calendar-plus", "texto": "Aún no hay ediciones registradas.", "accion": "Crear edición",
                 "url": reverse("portal:panel-edicion-nueva"), "permiso_url": "ediciones.crear"}]
    filas = []
    if not hay_activa:
        filas.append({"icono": "exclamation-triangle", "texto": "Ninguna edición está activa: el público no ve votaciones.",
                      "accion": "Activar una edición", "url": reverse("portal:panel-ediciones"), "permiso_url": "ediciones.editar"})
    if edicion.estado != Edicion.Estado.ACTIVA:
        return filas  # Una edición cerrada solo se consulta
    if edicion.votaciones_pausadas:
        filas.append({"icono": "pause-circle", "texto": "La recepción de votos está en pausa: nadie puede votar.",
                      "accion": "Revisar la pausa", "url": reverse("portal:panel-configuracion"),
                      "permiso_url": "configuracion.editar"})
    sin_votaciones = [c.nombre for c in categorias if c.activa and not c.num_votaciones]
    if sin_votaciones:
        filas.append({"icono": "grid", "texto": f"Categorías sin votaciones: {', '.join(sin_votaciones)}.",
                      "accion": "Crear votación", "url": reverse("portal:panel-votacion-nueva"), "permiso_url": "votaciones.crear"})
    for votacion in (v for v in votaciones if not v.publicada):
        faltan = OPCIONES_MINIMAS - votacion.num_opciones
        if faltan > 0:
            filas.append({"icono": "list-ol", "accion": "Agregar opciones",
                          "texto": f"«{votacion.titulo}» necesita {contar(faltan, 'opción más', 'opciones más')} para publicarse.",
                          "url": reverse("portal:panel-opciones", args=[votacion.pk]), "permiso_url": "opciones.crear"})
        else:
            filas.append({"icono": "megaphone", "texto": f"«{votacion.titulo}» está lista para publicarse.", "accion": "Revisar y publicar",
                          "url": reverse("portal:panel-opciones", args=[votacion.pk]), "permiso_url": "votaciones.publicar"})
    return filas


@requiere_permiso("panel.ver")
def inicio(request):
    edicion = edicion_panel(request)
    categorias = list(
        edicion.categorias.annotate(num_votaciones=Count("votaciones")).order_by("orden", "nombre")
    ) if edicion else []
    votaciones = list(
        Votacion.objects.filter(categoria__edicion=edicion).select_related("categoria__edicion")
        .annotate(num_votos=Count("votos", distinct=True),
                  num_opciones=Count("opciones", filter=Q(opciones__activa=True), distinct=True))
    )
    abiertas = [v for v in votaciones if v.publicada and v.estado == Votacion.Estado.ABIERTA]
    edicion_activa_real = selectores.edicion_activa()
    usuario = request.user
    return render_panel(request, "portal/panel/inicio.html", "inicio", edicion, {
        # Cada bloque según el rol: sin `resultados.ver` no hay conteos de votos y sin `auditoria.ver` no hay actividad
        "kpis": con_permiso(usuario, indicadores(categorias, votaciones, abiertas)),
        "pasos": con_permiso(usuario, ruta_trabajo(edicion, categorias, votaciones)),
        "pendientes": con_permiso(usuario, pendientes_de(edicion, categorias, votaciones, edicion_activa_real is not None)),
        "abiertas": abiertas if usuario.tiene_permiso("votaciones.ver") else [],
        "actividad": actividad_reciente() if usuario.tiene_permiso("auditoria.ver") else None,
        "es_activa": edicion is not None and edicion.estado == Edicion.Estado.ACTIVA,
        "edicion_activa_real": edicion_activa_real,
    })
