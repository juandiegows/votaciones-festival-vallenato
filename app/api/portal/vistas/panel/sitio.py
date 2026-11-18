"""
Sitio público desde el panel: banners del inicio, revista institucional, contacto y redes sociales e identidad visual.
Las mismas pantallas de la web React (/panel/banner, /panel/revista, /panel/sitio y /panel/marca), con auditoría.
"""

from django.contrib import messages
from django.shortcuts import get_object_or_404, redirect
from django.views.decorators.http import require_POST

from votaciones.auditoria.mixins import auditar
from votaciones.sitio.models import BannerInicio, ConfiguracionSitio, RedSocial, Revista

from ...formularios import BannerForm, ConfiguracionForm, MarcaForm, RedSocialForm, RevistaForm
from ...marca import (
    ESTILOS_ALERTA, ESTILOS_BOTON, FORMAS, PESOS_BOTON, ROLES_BOTON, campo_color, compactar_marca, es_hex,
    fichas, normalizar_marca,
)
from .base import edicion_panel, es_formulario_nuevo, render_panel, requiere_permiso

CAMPOS_CONTACTO = ["nombre_organizacion", "telefono", "direccion", "correo", "texto_pie",
                   "aviso_superior", "subtitulo_logo", "texto_acerca", "mostrar_equipo"]


def nombre_banner(banner):
    return banner.titulo or banner.texto_alternativo


def guardar_con_archivo(request, form, campo, entidad, nombre):
    """Guarda, borra el archivo anterior si se reemplazó y deja la acción en la auditoría. Devuelve (objeto, nuevo)."""
    nuevo = form.instance.pk is None
    anterior = "" if nuevo else getattr(type(form.instance).objects.get(pk=form.instance.pk), campo).name
    objeto = form.save()
    archivo = getattr(objeto, campo)
    if anterior and anterior != archivo.name:
        archivo.storage.delete(anterior)
    auditar(request, "crear" if nuevo else "actualizar", entidad, objeto.pk, {"nombre": nombre(objeto)})
    return objeto, nuevo


def eliminar_con_archivo(request, objeto, campo, entidad, nombre):
    archivo, pk = getattr(objeto, campo), objeto.pk
    objeto.delete()
    if archivo:
        archivo.storage.delete(archivo.name)
    auditar(request, "eliminar", entidad, pk, {"nombre": nombre})


def mover_en(lista, pk, direccion):
    """Sube o baja un elemento y renumera el orden de toda la lista (1, 2, 3…). Devuelve si se movió."""
    lista = list(lista)
    indice = next((i for i, x in enumerate(lista) if x.pk == pk), None)
    destino = None if indice is None else indice + (-1 if direccion == "subir" else 1)
    if destino is None or not 0 <= destino < len(lista):
        return False
    lista[indice], lista[destino] = lista[destino], lista[indice]
    for orden, elemento in enumerate(lista, start=1):
        if elemento.orden != orden:
            elemento.orden = orden
            elemento.save(update_fields=["orden"])
    return True


# Banner de inicio


def banners_de(edicion):
    return BannerInicio.objects.filter(edicion=edicion).order_by("orden", "id")


@requiere_permiso("sitio.ver", crear="sitio.editar", editar="sitio.editar")
def banners(request, pk=None):
    edicion = edicion_panel(request)
    instancia = get_object_or_404(BannerInicio, pk=pk) if pk else None
    lista = list(banners_de(edicion)) if edicion else []
    form = None
    if edicion and (instancia or es_formulario_nuevo(request, "panel-banner-nuevo")):
        form = BannerForm(request.POST or None, request.FILES or None, instance=instancia or BannerInicio(edicion=edicion, orden=len(lista) + 1),
                          initial=None if instancia else {"activo": True})
        if not instancia:
            form.fields["imagen"].required = True
            form.fields["imagen"].error_messages["required"] = "Selecciona una imagen."
        if request.method == "POST" and form.is_valid():
            banner, nuevo = guardar_con_archivo(request, form, "imagen", "banner", nombre_banner)
            messages.success(request, f"Banner «{nombre_banner(banner)}» {'creado' if nuevo else 'actualizado'} correctamente.")
            return redirect("portal:panel-banner")
    configuracion = ConfiguracionSitio.obtener()
    en_inicio = next((b for b in lista if b.activo), None) if configuracion.modo_banner == ConfiguracionSitio.ModoBanner.FIJO else None
    return render_panel(request, "portal/panel/banner.html", "banner", edicion, {
        "lista": lista, "form": form, "instancia": instancia, "modo": configuracion.modo_banner,
        "modos": ConfiguracionSitio.ModoBanner.choices, "en_inicio": en_inicio,
    })


@requiere_permiso("sitio.ver", crear="sitio.editar", editar="sitio.editar")
@require_POST
def modo_banner(request):
    configuracion = ConfiguracionSitio.obtener()
    modo = request.POST.get("modo_banner")
    if modo in ConfiguracionSitio.ModoBanner.values and modo != configuracion.modo_banner:
        configuracion.modo_banner = modo
        configuracion.save(update_fields=["modo_banner"])
        auditar(request, "actualizar", "configuracion", configuracion.pk, {"campos": ["modo_banner"], "modo_banner": modo})
        messages.success(request, f"El inicio ahora muestra: {ConfiguracionSitio.ModoBanner(modo).label.lower()}.")
    return redirect("portal:panel-banner")


@requiere_permiso("sitio.ver", crear="sitio.editar", editar="sitio.editar")
@require_POST
def alternar_banner(request, pk):
    banner = get_object_or_404(BannerInicio, pk=pk)
    banner.activo = not banner.activo
    banner.save(update_fields=["activo"])
    auditar(request, "activar" if banner.activo else "desactivar", "banner", banner.pk, {"nombre": nombre_banner(banner)})
    messages.info(request, f"Banner «{nombre_banner(banner)}» {'activado' if banner.activo else 'desactivado'}.")
    return redirect("portal:panel-banner")


@requiere_permiso("sitio.ver", crear="sitio.editar", editar="sitio.editar")
@require_POST
def mover_banner(request, pk):
    banner = get_object_or_404(BannerInicio, pk=pk)
    if mover_en(banners_de(banner.edicion), banner.pk, request.POST.get("direccion")):
        auditar(request, "reordenar", "banner", banner.pk, {"nombre": nombre_banner(banner)})
        messages.success(request, "Orden actualizado.")
    return redirect("portal:panel-banner")


@requiere_permiso("sitio.ver", crear="sitio.editar", editar="sitio.editar")
@require_POST
def eliminar_banner(request, pk):
    banner = get_object_or_404(BannerInicio, pk=pk)
    nombre = nombre_banner(banner)
    eliminar_con_archivo(request, banner, "imagen", "banner", nombre)
    messages.success(request, f"Banner «{nombre}» eliminado.")
    return redirect("portal:panel-banner")


# Revista institucional


def revistas_ordenadas():
    return Revista.objects.order_by("orden", "-id")


@requiere_permiso("sitio.ver", crear="sitio.editar", editar="sitio.editar")
def revistas(request, pk=None):
    edicion = edicion_panel(request)
    instancia = get_object_or_404(Revista, pk=pk) if pk else None
    lista = list(revistas_ordenadas())
    form = None
    if instancia or es_formulario_nuevo(request, "panel-revista-nueva"):
        form = RevistaForm(request.POST or None, request.FILES or None, instance=instancia or Revista(orden=len(lista) + 1),
                           initial=None if instancia else {"activa": True})
        if not instancia:
            form.fields["archivo"].required = True
            form.fields["archivo"].error_messages["required"] = "Selecciona el PDF de la revista."
        if request.method == "POST" and form.is_valid():
            revista, nueva = guardar_con_archivo(request, form, "archivo", "revista", lambda r: r.titulo)
            messages.success(request, f"Revista «{revista.titulo}» {'publicada' if nueva else 'actualizada'} correctamente.")
            return redirect("portal:panel-revista")
    return render_panel(request, "portal/panel/revista.html", "revista", edicion, {
        "lista": lista, "form": form, "instancia": instancia, "en_inicio": next((r for r in lista if r.activa), None),
    })


@requiere_permiso("sitio.ver", crear="sitio.editar", editar="sitio.editar")
@require_POST
def alternar_revista(request, pk):
    revista = get_object_or_404(Revista, pk=pk)
    revista.activa = not revista.activa
    revista.save(update_fields=["activa"])
    auditar(request, "activar" if revista.activa else "desactivar", "revista", revista.pk, {"nombre": revista.titulo})
    messages.info(request, f"Revista «{revista.titulo}» {'activada' if revista.activa else 'desactivada'}.")
    return redirect("portal:panel-revista")


@requiere_permiso("sitio.ver", crear="sitio.editar", editar="sitio.editar")
@require_POST
def mover_revista(request, pk):
    revista = get_object_or_404(Revista, pk=pk)
    if mover_en(revistas_ordenadas(), revista.pk, request.POST.get("direccion")):
        auditar(request, "reordenar", "revista", revista.pk, {"nombre": revista.titulo})
        messages.success(request, "Orden actualizado.")
    return redirect("portal:panel-revista")


@requiere_permiso("sitio.ver", crear="sitio.editar", editar="sitio.editar")
@require_POST
def eliminar_revista(request, pk):
    revista = get_object_or_404(Revista, pk=pk)
    titulo = revista.titulo
    eliminar_con_archivo(request, revista, "archivo", "revista", titulo)
    messages.success(request, f"Revista «{titulo}» eliminada.")
    return redirect("portal:panel-revista")


# Contacto y redes sociales


def redes_ordenadas():
    return RedSocial.objects.order_by("orden", "id")


@requiere_permiso("sitio.ver", crear="sitio.editar", editar="sitio.editar")
def sitio(request, pk=None):
    """Contacto y textos del pie (formulario `contacto`) y redes sociales (formulario `red`, nueva o en edición)."""
    edicion = edicion_panel(request)
    configuracion = ConfiguracionSitio.obtener()
    red_editada = get_object_or_404(RedSocial, pk=pk) if pk else None
    lista = list(redes_ordenadas())
    enviado = request.POST.get("formulario") if request.method == "POST" else None
    form = ConfiguracionForm(request.POST if enviado == "contacto" else None, instance=configuracion, campos=CAMPOS_CONTACTO)
    form_red = RedSocialForm(request.POST if enviado == "red" else None,
                             instance=red_editada or RedSocial(orden=len(lista) + 1), initial=None if red_editada else {"activa": True})
    if enviado == "contacto" and form.is_valid():
        form.save()
        if form.changed_data:
            auditar(request, "actualizar", "configuracion", configuracion.pk, {"seccion": "contacto", "campos": form.changed_data})
        messages.success(request, "Datos del sitio guardados." if form.changed_data else "No había cambios por guardar.")
        return redirect("portal:panel-sitio")
    if enviado == "red" and form_red.is_valid():
        nueva = form_red.instance.pk is None
        red = form_red.save()
        auditar(request, "crear" if nueva else "actualizar", "red_social", red.pk, {"nombre": red.nombre})
        messages.success(request, f"Red «{red.nombre}» {'agregada' if nueva else 'guardada'}.")
        return redirect("portal:panel-sitio")
    return render_panel(request, "portal/panel/sitio.html", "sitio", edicion, {
        "form": form, "form_red": form_red, "red_editada": red_editada, "lista": lista,
    })


@requiere_permiso("sitio.ver", crear="sitio.editar", editar="sitio.editar")
@require_POST
def mover_red(request, pk):
    red = get_object_or_404(RedSocial, pk=pk)
    if mover_en(redes_ordenadas(), red.pk, request.POST.get("direccion")):
        auditar(request, "reordenar", "red_social", red.pk, {"nombre": red.nombre})
        messages.success(request, "Orden actualizado.")
    return redirect("portal:panel-sitio")


@requiere_permiso("sitio.ver", crear="sitio.editar", editar="sitio.editar")
@require_POST
def eliminar_red(request, pk):
    red = get_object_or_404(RedSocial, pk=pk)
    nombre, red_pk = red.nombre, red.pk
    red.delete()
    auditar(request, "eliminar", "red_social", red_pk, {"nombre": nombre})
    messages.success(request, f"Red «{nombre}» quitada.")
    return redirect("portal:panel-sitio")


# Identidad visual


@requiere_permiso("sitio.ver", crear="sitio.editar", editar="sitio.editar")
def marca(request):
    edicion = edicion_panel(request)
    configuracion = ConfiguracionSitio.obtener()
    form = MarcaForm(request.POST or None, marca=configuracion.marca)
    if request.method == "POST" and form.is_valid():
        nueva = compactar_marca(form.marca())
        if nueva != (configuracion.marca or {}):
            configuracion.marca = nueva
            configuracion.save(update_fields=["marca"])
            auditar(request, "actualizar", "configuracion", configuracion.pk, {"seccion": "marca"})
            messages.success(request, "Identidad visual guardada: el sitio ya usa los nuevos colores y estilos.")
        else:
            messages.info(request, "No había cambios por guardar.")
        return redirect("portal:panel-marca")
    actual = normalizar_marca(configuracion.marca)
    errores = {}
    if form.is_bound:
        # Con errores se conservan los colores válidos que se escribieron y se marca el campo de los demás
        for token in actual["colores"]:
            valor = form.data.get(campo_color(token), "")
            if es_hex(valor):
                actual["colores"][token] = valor.upper()
        errores = {campo: " ".join(lista) for campo, lista in form.errors.items()}
    grupos = fichas(actual["colores"])
    for color in (c for g in grupos for c in g["colores"]):
        color["error"] = errores.get(color["campo"], "")
    return render_panel(request, "portal/panel/marca.html", "marca", edicion, {
        "form": form, "grupos": grupos,
        "roles": [{"clave": rol, "nombre": nombre, "boton": actual["botones"][rol]} for rol, nombre in ROLES_BOTON.items()],
        "alertas": actual["alertas"], "estilos_boton": ESTILOS_BOTON, "formas": FORMAS, "pesos": PESOS_BOTON,
        "estilos_alerta": ESTILOS_ALERTA, "personalizada": bool(configuracion.marca),
    })


@requiere_permiso("sitio.ver", crear="sitio.editar", editar="sitio.editar")
@require_POST
def restablecer_marca(request):
    configuracion = ConfiguracionSitio.obtener()
    if configuracion.marca:
        configuracion.marca = {}
        configuracion.save(update_fields=["marca"])
        auditar(request, "actualizar", "configuracion", configuracion.pk, {"seccion": "marca", "restablecida": True})
        messages.success(request, "Se restableció la marca base del Festival.")
    return redirect("portal:panel-marca")
