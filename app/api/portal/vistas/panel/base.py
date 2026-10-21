"""Piezas compartidas del panel: acceso, edición elegida, guardado y eliminación con auditoría."""

from functools import wraps

from django.contrib import messages
from django.contrib.auth.views import redirect_to_login
from django.db.models import ProtectedError
from django.shortcuts import render

from votaciones.auditoria.mixins import auditar
from votaciones.comun.errores import ReglaNegocioError
from votaciones.models import Edicion
from votaciones.votacion import selectores

from ..errores import pagina_error

CLAVE_EDICION = "panel_edicion_id"

ENTIDADES = {
    "edicion": ("la edición", "Edición"), "categoria": ("la categoría", "Categoría"),
    "votacion": ("la votación", "Votación"), "opcion": ("la opción", "Opción"),
}


def solo_administrador(vista):
    """Decorador: sin sesión → al login (y de vuelta aquí); con sesión de votante → 403."""

    @wraps(vista)
    def envoltura(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect_to_login(request.get_full_path())
        if not request.user.es_administrador:
            return pagina_error(request, 403, "Solo un administrador puede entrar al panel.")
        return vista(request, *args, **kwargs)

    return envoltura


def edicion_panel(request):
    """Edición elegida en el selector del menú (se recuerda en la sesión); por defecto, la activa."""
    pedida = request.GET.get("edicion", "")
    if pedida.isdigit() and Edicion.objects.filter(pk=pedida).exists():
        request.session[CLAVE_EDICION] = int(pedida)
    elegida = Edicion.objects.filter(pk=request.session.get(CLAVE_EDICION)).first()
    return elegida or selectores.edicion_activa() or Edicion.objects.order_by("-anio").first()


def es_formulario_nuevo(request, nombre_ruta):
    return request.resolver_match.url_name == nombre_ruta


def render_panel(request, plantilla, seccion, edicion, contexto):
    return render(request, plantilla, {
        "seccion": seccion, "edicion": edicion, "ediciones": Edicion.objects.order_by("-anio"), **contexto,
    })


def nombre_de(objeto):
    return getattr(objeto, "titulo", None) or getattr(objeto, "nombre", None) or str(objeto)


def guardar(request, form, entidad):
    """Guarda el formulario, registra la auditoría y avisa al administrador. Devuelve (objeto, nuevo)."""
    nuevo = form.instance.pk is None
    objeto = form.save()
    auditar(request, "crear" if nuevo else "actualizar", entidad, objeto.pk, {"nombre": nombre_de(objeto)})
    return objeto, nuevo


def avisar_guardado(request, entidad, objeto, nuevo):
    etiqueta = ENTIDADES[entidad][1]
    messages.success(request, f"{etiqueta} «{nombre_de(objeto)}» {'creada' if nuevo else 'actualizada'} correctamente.")


def archivos_de(objeto):
    return [archivo for archivo in (getattr(objeto, "icono_imagen", None), getattr(objeto, "audio", None)) if archivo]


def eliminar(request, objeto, entidad, regla=None):
    """Elimina con auditoría. `regla` lanza ReglaNegocioError si no se puede (p. ej. tiene votos, RN-09)."""
    nombre, pk, archivos = nombre_de(objeto), objeto.pk, archivos_de(objeto)
    try:
        if regla:
            regla(objeto)
        objeto.delete()
    except ReglaNegocioError as error:
        messages.warning(request, f"No se puede eliminar «{nombre}»: {error.mensaje}")
        return
    except ProtectedError:
        messages.warning(request, f"No se puede eliminar «{nombre}» porque tiene registros asociados; desactívalo.")
        return
    for archivo in archivos:
        archivo.storage.delete(archivo.name)
    auditar(request, "eliminar", entidad, pk, {"nombre": nombre})
    messages.success(request, f"{ENTIDADES[entidad][1]} «{nombre}» eliminada.")


def alternar_activa(request, objeto, entidad):
    """Activa o desactiva (sin borrar) y lo deja en la auditoría."""
    objeto.activa = not objeto.activa
    objeto.save(update_fields=["activa"])
    auditar(request, "activar" if objeto.activa else "desactivar", entidad, objeto.pk, {"nombre": nombre_de(objeto)})
    return objeto.activa


def bloqueo_por_hijos(request, objeto, total, hijos):
    """Regla común: no se elimina un registro con hijos asociados (se desactiva)."""
    if total:
        messages.warning(request, f"No se puede eliminar «{nombre_de(objeto)}»: tiene {total} {hijos} asociada(s).")
        return True
    return False
