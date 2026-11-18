"""
Auditoría en pestañas (como /panel/auditoria de la web React): integridad de los votos de la edición, autoría de
los registros y acciones de la administración. «Quién votó» está en Votos y resultados.
"""

from django.core.paginator import Paginator

from votaciones.auditoria import selectores
from votaciones.votacion import reportes

from .base import edicion_panel, render_panel, solo_administrador

PESTANAS = {
    "integridad": {"titulo": "Integridad de votos", "icono": "shield-check"},
    "autoria": {"titulo": "Autoría de registros", "icono": "person-badge"},
    "acciones": {"titulo": "Acciones de administración", "icono": "clock-history"},
}
TIPOS_REGISTRO = {
    "edicion": "Edición", "categoria": "Categoría", "votacion": "Votación", "opcion": "Opción", "banner": "Banner",
    "revista": "Revista", "red_social": "Red social", "configuracion": "Configuración", "voto": "Voto", "usuario": "Usuario",
}
VERBOS = {
    "crear": "Creó", "actualizar": "Actualizó", "eliminar": "Eliminó", "publicar": "Publicó", "despublicar": "Despublicó",
    "cerrar": "Cerró", "activar": "Activó", "desactivar": "Desactivó", "reordenar": "Reordenó",
    "exportar_resultados": "Exportó los resultados de", "exportar_edicion": "Exportó", "importar_edicion": "Importó",
    "publicar_resultados": "Publicó o retiró los resultados de", "eliminar_demo": "Eliminó los datos de demostración en",
    "cargar_demo": "Cargó los datos de demostración en", "cambiar_rol": "Cambió el rol de",
}
ARTICULOS = {
    "edicion": "la edición", "categoria": "la categoría", "votacion": "la votación", "opcion": "la opción",
    "banner": "el banner", "revista": "la revista", "red_social": "la red social", "configuracion": "la configuración", "usuario": "la cuenta",
}
POR_PAGINA = 50


def texto_accion(registro):
    """crear + categoria + {"nombre": "Música"} → Creó la categoría «Música»."""
    detalle = registro.detalle if isinstance(registro.detalle, dict) else {}
    verbo = VERBOS.get(registro.accion, registro.accion.replace("_", " ").capitalize())
    if registro.accion == "publicar_resultados":
        verbo = "Publicó los resultados de" if detalle.get("publicar") else "Retiró los resultados de"
    sujeto = ARTICULOS.get(registro.entidad, registro.entidad)
    nombre = detalle.get("titulo") or detalle.get("nombre") or detalle.get("email") or detalle.get("seccion") or (f"#{registro.entidad_id}" if registro.entidad_id else "")
    return f"{verbo} {sujeto} «{nombre}»" if nombre else f"{verbo} {sujeto}"


def acciones(request):
    accion, entidad, texto = request.GET.get("accion", ""), request.GET.get("entidad", ""), request.GET.get("q", "").strip()
    pagina = Paginator(selectores.registros(accion or None, entidad or None, texto), POR_PAGINA).get_page(request.GET.get("pagina"))
    for registro in pagina:
        registro.texto = texto_accion(registro)
    return {"pagina": pagina, "filtro_accion": accion, "filtro_entidad": entidad, "busqueda": texto, "verbos": VERBOS}


def autoria(request, edicion):
    tipo, texto = request.GET.get("tipo", ""), request.GET.get("q", "").strip().lower()
    filas = selectores.autoria(edicion)["registros"]
    visibles = [
        {**f, "tipo": TIPOS_REGISTRO.get(f["entidad"], f["entidad"])} for f in filas
        if (not tipo or f["entidad"] == tipo)
        and (not texto or texto in f"{f['nombre']} {f['creado_por'] or ''} {f['actualizado_por'] or ''}".lower())
    ]
    return {"filas": visibles, "filtro_tipo": tipo, "busqueda": texto}


@solo_administrador
def auditoria(request):
    edicion = edicion_panel(request)
    clave = request.GET.get("pestana")
    if clave not in PESTANAS:
        clave = "integridad"
    contexto = {}
    if clave == "acciones":
        contexto = acciones(request)
    elif edicion and clave == "autoria":
        contexto = autoria(request, edicion)
    elif edicion:
        contexto = {"integridad": reportes.verificar_integridad(edicion)}
    return render_panel(request, "portal/panel/auditoria.html", "auditoria", edicion, {
        "clave": clave, "pestanas": [{"clave": k, **v} for k, v in PESTANAS.items()],
        "tipos": TIPOS_REGISTRO, **contexto,
    })
