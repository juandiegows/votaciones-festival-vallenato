"""Exportar resultados (PDF, Excel, CSV, JSON o SQL) e importar o exportar ediciones completas con la plantilla de Excel."""

from django.contrib import messages
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404, redirect

from votaciones.auditoria.mixins import auditar
from votaciones.models import Categoria, Edicion, Votacion
from votaciones.votacion import exportacion, transferencia

from .base import edicion_panel, render_panel, solo_administrador

# tipo de la URL → (consulta, función del reporte, entidad de auditoría)
EXPORTABLES = {
    "votacion": (Votacion.objects.select_related("categoria__edicion"), exportacion.reporte_votacion, "votacion"),
    "categoria": (Categoria.objects.select_related("edicion"), exportacion.reporte_categoria, "categoria"),
    "edicion": (Edicion.objects.all(), exportacion.reporte_edicion, "edicion"),
}
TIPO_EXCEL = exportacion.FORMATOS["excel"][1]


def descarga(contenido, tipo, nombre):
    respuesta = HttpResponse(contenido, content_type=tipo)
    respuesta["Content-Disposition"] = f'attachment; filename="{nombre}"'
    return respuesta


@solo_administrador
def exportar(request, tipo, pk, formato):
    """Resultados de una votación, una categoría o una edición en el formato pedido (solo conteos, voto secreto)."""
    if tipo not in EXPORTABLES or formato not in exportacion.FORMATOS:
        raise Http404
    consulta, reporte, entidad = EXPORTABLES[tipo]
    objeto = get_object_or_404(consulta, pk=pk)
    contenido, mime, nombre = exportacion.generar(reporte(objeto), formato)
    auditar(request, "exportar_resultados", entidad, objeto.pk, {"formato": formato})
    return descarga(contenido, mime, nombre)


@solo_administrador
def plantilla(request):
    return descarga(transferencia.plantilla_excel(), TIPO_EXCEL, "plantilla-edicion.xlsx")


@solo_administrador
def estructura(request, pk):
    edicion = get_object_or_404(Edicion, pk=pk)
    auditar(request, "exportar_edicion", "edicion", edicion.pk)
    return descarga(transferencia.plantilla_excel(edicion), TIPO_EXCEL, f"edicion-{edicion.anio}.xlsx")


@solo_administrador
def importar(request):
    errores = []
    if request.method == "POST":
        archivo = request.FILES.get("archivo")
        if not archivo:
            errores = [{"hoja": "", "fila": None, "mensaje": "Elige la plantilla de Excel que vas a subir."}]
        else:
            try:
                edicion = transferencia.importar_excel(archivo, activar=request.POST.get("activar") == "on")
            except transferencia.ErrorImportacion as e:
                errores = e.errores
            else:
                datos = transferencia.resumen(edicion)
                auditar(request, "importar_edicion", "edicion", edicion.pk, datos)
                messages.success(
                    request,
                    f"Edición «{edicion.nombre}» importada: {datos['categorias']} categoría(s), {datos['votaciones']} "
                    f"votación(es) en borrador y {datos['opciones']} opción(es)."
                    + ("" if edicion.estado == Edicion.Estado.ACTIVA else " Quedó cerrada: actívala cuando esté lista."),
                )
                return redirect("portal:panel-ediciones")
    return render_panel(request, "portal/panel/importar_edicion.html", "ediciones", edicion_panel(request), {"errores": errores})
