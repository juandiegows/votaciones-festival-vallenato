"""Ajustes del sistema en pestañas por tarea; cada pestaña guarda solo sus campos."""

from django.contrib import messages
from django.db.models import Count
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse
from django.views.decorators.http import require_POST

from votaciones.auditoria.mixins import auditar
from votaciones.comun.errores import ReglaNegocioError
from votaciones.models import Categoria
from votaciones.sitio.models import ConfiguracionSitio
from votaciones.votacion import servicios

from ...formularios import ConfiguracionEdicionForm, ConfiguracionForm
from .base import edicion_panel, render_panel, solo_administrador

SECCIONES = {
    "votacion": {"titulo": "Votación", "icono": "check2-square", "descripcion": "Abre o pausa la recepción de votos y define cuántas veces se vota en cada categoría.",
                 "sitio": [], "edicion": ["votaciones_pausadas"]},
    "registro": {"titulo": "Registro", "icono": "person-badge", "descripcion": "Qué se le pide a una persona para crear su cuenta y poder votar.",
                 "sitio": ["pedir_documento"], "edicion": []},
    "privacidad": {"titulo": "Privacidad", "icono": "shield-lock", "descripcion": "Qué puede ver la administración sobre quién participó. El voto siempre es secreto.",
                   "sitio": ["mostrar_participantes", "umbral_participacion"], "edicion": []},
    "resultados": {"titulo": "Resultados", "icono": "bar-chart", "descripcion": "Qué ve el público sobre los resultados y por cuánto tiempo.",
                   "sitio": ["mostrar_total_votos", "dias_visible_cerradas"], "edicion": ["visibilidad_resultados"]},
    "sitio": {"titulo": "Sitio", "icono": "window", "descripcion": "Banner del inicio, datos de contacto y documentación de la API.",
              "sitio": ["modo_banner", "nombre_organizacion", "telefono", "direccion", "correo", "texto_pie", "mostrar_swagger"], "edicion": []},
}


def url_seccion(clave):
    return f"{reverse('portal:panel-configuracion')}?seccion={clave}"


@solo_administrador
def configuracion(request):
    edicion = edicion_panel(request)
    clave = request.GET.get("seccion")
    if clave not in SECCIONES:
        clave = "votacion"
    seccion = SECCIONES[clave]
    datos = request.POST if request.method == "POST" else None
    form = ConfiguracionForm(datos, instance=ConfiguracionSitio.obtener(), campos=seccion["sitio"])
    form_edicion = ConfiguracionEdicionForm(datos, instance=edicion, campos=seccion["edicion"]) if edicion else None
    if request.method == "POST" and form.is_valid() and (form_edicion is None or form_edicion.is_valid()):
        form.save()
        cambios = list(form.changed_data)
        if form_edicion:
            form_edicion.save()
            cambios += form_edicion.changed_data
        if cambios:
            auditar(request, "actualizar", "configuracion", form.instance.pk, {"seccion": clave, "campos": cambios})
        messages.success(request, f"{seccion['titulo']}: cambios guardados." if cambios else "No había cambios por guardar.")
        return redirect(url_seccion(clave))
    categorias = []
    if edicion and clave == "votacion":
        categorias = Categoria.objects.filter(edicion=edicion).annotate(num_votos=Count("votos")).order_by("orden", "nombre")
    return render_panel(request, "portal/panel/configuracion.html", "configuracion", edicion, {
        "form": form, "form_edicion": form_edicion, "categorias": categorias, "clave": clave, "seccion_config": seccion,
        "secciones": [{"clave": k, **v} for k, v in SECCIONES.items()],
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
        return redirect(url_seccion("votacion"))
    categoria.voto_unico = nuevo
    categoria.save(update_fields=["voto_unico"])
    auditar(request, "actualizar", "categoria", categoria.pk, {"nombre": categoria.nombre, "voto_unico": nuevo})
    regla = "un solo voto en toda la categoría" if nuevo else "un voto en cada votación"
    messages.success(request, f"Categoría «{categoria.nombre}»: {regla}.")
    return redirect(url_seccion("votacion"))
