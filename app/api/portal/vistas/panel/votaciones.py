"""CRUD de votaciones de la edición elegida, con publicar, despublicar y cerrar (reglas en votacion.servicios)."""

from datetime import timedelta

from django.contrib import messages
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse
from django.utils import timezone
from django.utils.html import format_html
from django.views.decorators.http import require_POST

from votaciones.auditoria.mixins import auditar
from votaciones.comun.errores import ReglaNegocioError
from votaciones.models import Categoria, Votacion
from votaciones.votacion import servicios

from ...catalogos import DESCRIPCION_VISIBILIDAD, ICONOS_DISPONIBLES, OPCIONES_EJEMPLO, PRESENTACIONES_OPCIONES
from ...formularios import VotacionForm
from .base import edicion_panel, eliminar, es_formulario_nuevo, guardar, render_panel, solo_administrador

ESTADOS_FILTRO = [
    ("abierta", "Abierta"), ("programada", "Programada"), ("cerrada", "Cerrada"), ("borrador", "Borrador (sin publicar)"),
]


def valores_nueva_votacion(request, edicion):
    """Abre en la próxima hora en punto y dura una semana; hereda la visibilidad de la edición."""
    apertura = timezone.localtime().replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    categoria = request.GET.get("categoria", "")
    return {
        "categoria": categoria if categoria.isdigit() else None, "icono": "check2-square",
        "fecha_apertura": apertura, "fecha_cierre": apertura + timedelta(days=7),
        "visibilidad_resultados": edicion.visibilidad_resultados if edicion else Votacion.Visibilidad.AL_CIERRE,
        "presentacion_opciones": Votacion.PresentacionOpciones.TARJETAS,
    }


def avisar(request, votacion, nueva):
    if not nueva:
        messages.success(request, f"Votación «{votacion.titulo}» actualizada correctamente.")
        return
    enlace = reverse("portal:panel-opciones", args=[votacion.pk])
    messages.success(request, format_html(
        "Votación «{}» creada como borrador. <a class=\"alert-link\" href=\"{}\">Agrega al menos 2 opciones</a> para publicarla.",
        votacion.titulo, enlace,
    ))


def listar(edicion, busqueda, categoria, estado):
    consulta = (
        Votacion.objects.filter(categoria__edicion=edicion).select_related("categoria__edicion")
        .annotate(num_opciones=Count("opciones", filter=Q(opciones__activa=True), distinct=True),
                  num_votos=Count("votos", distinct=True))
        .order_by("categoria__orden", "fecha_apertura")
    )
    if busqueda:
        consulta = consulta.filter(Q(titulo__icontains=busqueda) | Q(descripcion__icontains=busqueda))
    if categoria.isdigit():
        consulta = consulta.filter(categoria_id=categoria)
    # El estado se calcula con la hora actual (no es una columna)
    return [v for v in consulta if not estado or v.estado == estado]


def opciones_vista_previa(instancia):
    """Opciones reales de la votación para la vista previa; si aún no tiene dos, las de ejemplo."""
    reales = list(instancia.opciones.filter(activa=True).order_by("orden", "id")[:6]) if instancia else []
    return (reales, True) if len(reales) >= 2 else (OPCIONES_EJEMPLO, False)


@solo_administrador
def votaciones(request, pk=None):
    edicion = edicion_panel(request)
    instancia = get_object_or_404(Votacion.objects.select_related("categoria__edicion"), pk=pk) if pk else None
    edicion_formulario = instancia.categoria.edicion if instancia else edicion
    form = None
    if instancia or es_formulario_nuevo(request, "panel-votacion-nueva"):
        inicial = None if instancia else valores_nueva_votacion(request, edicion)
        form = VotacionForm(request.POST or None, request.FILES or None, instance=instancia, initial=inicial,
                            edicion=edicion_formulario)
        if request.method == "POST" and form.is_valid():
            avisar(request, *guardar(request, form, "votacion"))
            return redirect("portal:panel-votaciones")
    muestra, son_reales = opciones_vista_previa(instancia)
    busqueda, estado = request.GET.get("q", "").strip(), request.GET.get("estado", "")
    categoria = "" if form else request.GET.get("categoria", "")
    return render_panel(request, "portal/panel/votaciones.html", "votaciones", edicion, {
        "lista": listar(edicion, busqueda, categoria, estado), "form": form, "instancia": instancia,
        "busqueda": busqueda, "filtro_categoria": categoria, "filtro_estado": estado, "estados": ESTADOS_FILTRO,
        "categorias": Categoria.objects.filter(edicion=edicion).order_by("orden", "nombre"),
        "presentaciones": PRESENTACIONES_OPCIONES, "iconos": ICONOS_DISPONIBLES,
        "descripcion_visibilidad": DESCRIPCION_VISIBILIDAD, "edicion_formulario": edicion_formulario,
        "presentacion_actual": (form["presentacion_opciones"].value() if form else None) or Votacion.PresentacionOpciones.TARJETAS,
        "muestra_opciones": muestra, "muestra_reales": son_reales, "muestra_marcadas": {muestra[0].pk},
    })


def ejecutar(request, pk, servicio, accion, resultado):
    """Publicar, despublicar o cerrar: aplica la regla de negocio, audita y avisa."""
    votacion = get_object_or_404(Votacion.objects.select_related("categoria__edicion"), pk=pk)
    try:
        servicio(votacion)
    except ReglaNegocioError as error:
        messages.error(request, error.mensaje)
    else:
        auditar(request, accion, "votacion", votacion.pk, {"titulo": votacion.titulo})
        messages.success(request, f"Votación «{votacion.titulo}» {resultado}.")
    return redirect("portal:panel-votaciones")


@solo_administrador
@require_POST
def publicar_votacion(request, pk):
    return ejecutar(request, pk, servicios.publicar_votacion, "publicar", "publicada: ya es visible al público")


@solo_administrador
@require_POST
def despublicar_votacion(request, pk):
    return ejecutar(request, pk, servicios.despublicar_votacion, "despublicar", "retirada del sitio público")


@solo_administrador
@require_POST
def cerrar_votacion(request, pk):
    return ejecutar(request, pk, servicios.cerrar_votacion, "cerrar", "cerrada: ya no recibe votos")


@solo_administrador
@require_POST
def eliminar_votacion(request, pk):
    eliminar(request, get_object_or_404(Votacion, pk=pk), "votacion", servicios.validar_eliminacion)
    return redirect("portal:panel-votaciones")
