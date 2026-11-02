"""Pantalla única con los ajustes del sistema: cuentas, reglas de voto, privacidad, resultados y sitio."""

from django.contrib import messages
from django.db.models import Count
from django.shortcuts import get_object_or_404, redirect
from django.views.decorators.http import require_POST

from votaciones.auditoria.mixins import auditar
from votaciones.comun.errores import ReglaNegocioError
from votaciones.models import Categoria
from votaciones.sitio.models import ConfiguracionSitio
from votaciones.votacion import servicios

from ...formularios import ConfiguracionEdicionForm, ConfiguracionForm
from .base import edicion_panel, render_panel, solo_administrador


@solo_administrador
def configuracion(request):
    edicion = edicion_panel(request)
    sitio = ConfiguracionSitio.obtener()
    datos = request.POST if request.method == "POST" else None
    form = ConfiguracionForm(datos, instance=sitio)
    form_edicion = ConfiguracionEdicionForm(datos, instance=edicion) if edicion else None
    if request.method == "POST" and form.is_valid() and (form_edicion is None or form_edicion.is_valid()):
        form.save()
        cambios = list(form.changed_data)
        if form_edicion:
            form_edicion.save()
            cambios += form_edicion.changed_data
        if cambios:
            auditar(request, "actualizar", "configuracion", sitio.pk, {"campos": cambios})
        messages.success(request, "Configuración guardada." if cambios else "No había cambios por guardar.")
        return redirect("portal:panel-configuracion")
    categorias = (
        Categoria.objects.filter(edicion=edicion).annotate(num_votos=Count("votos")).order_by("orden", "nombre")
        if edicion else []
    )
    return render_panel(request, "portal/panel/configuracion.html", "configuracion", edicion, {
        "form": form, "form_edicion": form_edicion, "categorias": categorias,
    })


@solo_administrador
@require_POST
def alternar_voto_unico(request, pk):
    categoria = get_object_or_404(Categoria, pk=pk)
    nuevo = not categoria.voto_unico
    try:
        servicios.validar_cambio_voto_unico(categoria, nuevo)
    except ReglaNegocioError as error:
        messages.warning(request, error.mensaje)
        return redirect("portal:panel-configuracion")
    categoria.voto_unico = nuevo
    categoria.save(update_fields=["voto_unico"])
    auditar(request, "actualizar", "categoria", categoria.pk, {"nombre": categoria.nombre, "voto_unico": nuevo})
    regla = "un solo voto en toda la categoría" if nuevo else "un voto en cada votación"
    messages.success(request, f"Categoría «{categoria.nombre}»: {regla}.")
    return redirect("portal:panel-configuracion")
