"""
Proceso de voto en el sitio Django: votar, comprobante, mis votos y documento. Las reglas (correo confirmado,
documento, votación abierta, límite de votos) viven en votaciones.votacion.servicios.emitir_voto, las mismas de la API.
"""

from urllib.parse import urlencode

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.views import redirect_to_login
from django.shortcuts import redirect, render
from django.urls import reverse
from django.views.decorators.http import require_POST

from votaciones import correo
from votaciones.comun.api import ip_cliente
from votaciones.comun.errores import ReglaNegocioError
from votaciones.cuentas import servicios as servicios_cuentas
from votaciones.votacion import selectores, servicios

from .. import consultas
from ..formularios import CompletarDocumentoForm
from .cuentas import destino_seguro
from .errores import pagina_error
from .publico import resultados_publicos, votacion_por_ruta


def url_votacion(votacion, opcion=None):
    url = reverse("portal:votacion", args=[votacion.categoria.edicion.anio, votacion.categoria.slug, votacion.slug])
    return f"{url}?{urlencode({'opcion': opcion})}#lista-opciones" if opcion else url


def url_comprobante(votacion):
    return reverse("portal:comprobante", args=[votacion.categoria.edicion.anio, votacion.categoria.slug, votacion.slug])


@require_POST
def votar(request, anio, categoria, votacion):
    votacion = votacion_por_ruta(request, consultas.edicion_publica(anio), categoria, votacion)
    if votacion is None:
        return pagina_error(request, 404, "La votación no existe o aún no ha sido publicada.")
    opcion = request.POST.get("opcion", "")
    if not opcion.isdigit():
        messages.error(request, "Selecciona una opción antes de votar.")
        return redirect(url_votacion(votacion))
    # Sin sesión: se inicia sesión y se vuelve a la votación con la opción ya marcada
    if not request.user.is_authenticated:
        messages.info(request, "Inicia sesión o regístrate para registrar tu voto. Guardamos tu selección.")
        return redirect_to_login(url_votacion(votacion, opcion))
    if servicios_cuentas.falta_documento(request.user):
        return redirect(f"{reverse('portal:completar-documento')}?{urlencode({'next': url_votacion(votacion, opcion)})}")
    try:
        voto = servicios.emitir_voto(request.user, votacion.pk, int(opcion), ip_cliente(request))
    except ReglaNegocioError as error:
        messages.error(request, error.mensaje)
        return redirect(url_votacion(votacion, opcion))
    # Mismo correo que la API: sale cuando el voto quedó guardado
    correo.enviar_al_confirmar(correo.enviar_comprobante_voto, voto)
    messages.success(request, f"Tu voto quedó registrado. Te enviamos el comprobante a {request.user.email}.")
    return redirect(url_comprobante(votacion))


@login_required
def comprobante(request, anio, categoria, votacion):
    votacion = votacion_por_ruta(request, consultas.edicion_publica(anio), categoria, votacion)
    if votacion is None:
        return pagina_error(request, 404, "La votación no existe o aún no ha sido publicada.")
    voto = selectores.votos_de(request.user).filter(votacion=votacion).order_by("fecha_hora").first()
    return render(request, "portal/comprobante.html", {
        "edicion": votacion.categoria.edicion,
        "categoria": votacion.categoria,
        "votacion": votacion,
        "voto": voto,
        "url_votacion": url_votacion(votacion),
        "resultados": resultados_publicos(votacion, request.user) if voto else None,
        # El botón «Imprimir» del correo llega con ?imprimir=1
        "imprimir": request.GET.get("imprimir") == "1",
    })


@login_required
def mis_votos(request):
    votos = selectores.votos_de(request.user).order_by("-fecha_hora")
    return render(request, "portal/mis_votos.html", {
        "votos": [(voto, url_comprobante(voto.votacion)) for voto in votos],
    })


@login_required
def completar_documento(request):
    destino = destino_seguro(request, reverse("portal:categorias"))
    if not servicios_cuentas.falta_documento(request.user):
        return redirect(destino)
    form = CompletarDocumentoForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        try:
            servicios_cuentas.completar_documento(
                request.user, form.cleaned_data["tipo_documento"], form.cleaned_data["numero_documento"]
            )
        except ReglaNegocioError as error:
            messages.info(request, error.mensaje)
            return redirect(destino)
        messages.success(request, "Documento registrado. Ya puedes confirmar tu voto.")
        return redirect(destino)
    return render(request, "portal/completar_documento.html", {
        "form": form, "siguiente": request.POST.get("next") or request.GET.get("next", ""),
    })
