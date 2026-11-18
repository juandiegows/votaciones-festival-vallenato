"""Ajustes del sistema en pestañas por tarea; cada pestaña guarda solo sus campos."""

from django.conf import settings
from django.contrib import messages
from django.db.models import Count
from django.shortcuts import get_object_or_404, redirect
from django.urls import reverse
from django.views.decorators.http import require_POST

from votaciones.auditoria.mixins import auditar
from votaciones.comun.errores import ReglaNegocioError
from votaciones.models import Categoria
from votaciones.sitio import demo
from votaciones.sitio.models import ConfiguracionSitio
from votaciones.votacion import servicios

from ...formularios import ConfiguracionEdicionForm, ConfiguracionForm
from .base import edicion_panel, render_panel, requiere_permiso

# Secciones agrupadas por tema; cada una tiene su URL: /panel/configuracion/{clave}
SECCIONES = {
    "votacion": {"grupo": "Votación", "titulo": "Votación", "icono": "check2-square", "descripcion": "Abre o pausa la recepción de votos y define cuántas veces se vota en cada categoría.",
                 "sitio": [], "edicion": ["votaciones_pausadas"]},
    "registro": {"grupo": "Votación", "titulo": "Registro", "icono": "person-badge", "descripcion": "Qué se le pide a una persona para crear su cuenta y poder votar.",
                 "sitio": ["pedir_documento"], "edicion": []},
    "resultados": {"grupo": "Resultados y privacidad", "titulo": "Resultados", "icono": "bar-chart", "descripcion": "Qué ve el público sobre los resultados y por cuánto tiempo.",
                   "sitio": ["mostrar_total_votos", "dias_visible_cerradas"], "edicion": ["visibilidad_resultados"]},
    "privacidad": {"grupo": "Resultados y privacidad", "titulo": "Privacidad", "icono": "shield-lock", "descripcion": "Qué puede ver la administración sobre quién participó. El voto siempre es secreto.",
                   "sitio": ["mostrar_participantes", "umbral_participacion"], "edicion": []},
    "sitio": {"grupo": "Sitio público", "titulo": "Sitio", "icono": "window", "descripcion": "Banner del inicio, textos del proyecto, datos de contacto y documentación de la API.",
              "sitio": ["modo_banner", "nombre_organizacion", "telefono", "direccion", "correo", "texto_pie", "aviso_superior",
                        "subtitulo_logo", "texto_acerca", "mostrar_texto_pie", "mostrar_aviso_superior",
                        "mostrar_subtitulo_logo", "mostrar_texto_acerca", "mostrar_equipo", "mostrar_swagger"], "edicion": []},
    "predeterminados": {"grupo": "Administración", "titulo": "Valores por defecto", "icono": "ui-checks", "descripcion": "Cómo se crea cada edición, categoría o votación nueva. Después se puede cambiar en cada una.",
                        "sitio": ["defecto_presentacion_categorias", "defecto_visibilidad_resultados", "defecto_voto_unico",
                                  "defecto_categoria_activa", "defecto_presentacion_opciones", "defecto_dias_votacion"], "edicion": []},
    "demo": {"grupo": "Administración", "titulo": "Demostración", "icono": "person-badge-fill", "descripcion": "Cuentas y datos de prueba que crea cargar_demo: permitir su ingreso, eliminarlos o volver a cargarlos.",
             "sitio": ["permitir_cuentas_demo", "mostrar_credenciales_demo"], "edicion": []},
}


def url_seccion(clave):
    return reverse("portal:panel-configuracion-seccion", args=[clave])


@requiere_permiso("configuracion.ver", editar="configuracion.editar")
def configuracion(request, clave=None):
    edicion = edicion_panel(request)
    # /panel/configuracion y el formato anterior ?seccion=… llevan a /panel/configuracion/{sección}
    if clave is None:
        clave = request.GET.get("seccion")
        if request.method == "GET" or clave not in SECCIONES:
            return redirect(url_seccion(clave if clave in SECCIONES else "votacion"))
    if clave not in SECCIONES:
        return redirect(url_seccion("votacion"))
    seccion = SECCIONES[clave]
    datos = request.POST if request.method == "POST" else None
    form = ConfiguracionForm(datos, instance=ConfiguracionSitio.obtener(), campos=seccion["sitio"])
    form_edicion = ConfiguracionEdicionForm(datos, instance=edicion, campos=seccion["edicion"]) if edicion else None
    if request.method == "POST" and form.is_valid() and (form_edicion is None or form_edicion.is_valid()):
        if "permitir_cuentas_demo" in form.changed_data and not form.cleaned_data["permitir_cuentas_demo"]:
            try:
                demo.validar_administrador_propio(request.user, "apagar las cuentas de demostración")
            except ReglaNegocioError as error:
                messages.warning(request, error.mensaje)
                return redirect(url_seccion(clave))
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
        # Solo lectura: DEBUG se fija con DJANGO_DEBUG al arrancar el servidor y nunca desde el panel
        "modo_desarrollo": settings.DEBUG,
        **({"demo": demo.resumen(), "demo_anios": ", ".join(map(str, demo.ANIOS_DEMO)),
            "es_cuenta_demo": demo.es_cuenta_demo(request.user.email)} if clave == "demo" else {}),
    })


def accion_demo(request, palabra, funcion, exito):
    if request.POST.get("confirmacion", "").strip().upper() != palabra:
        messages.warning(request, f"Escribe {palabra} para confirmar.")
        return redirect(url_seccion("demo"))
    try:
        resultado = funcion(request.user)
    except ReglaNegocioError as error:
        messages.warning(request, error.mensaje)
        return redirect(url_seccion("demo"))
    auditar(request, f"{palabra.lower()}_demo", "configuracion", 1, {"resultado": resultado})
    messages.success(request, exito(resultado))
    return redirect(url_seccion("demo"))


@requiere_permiso("configuracion.ver", editar="configuracion.demo")
@require_POST
def eliminar_demo(request):
    return accion_demo(request, "ELIMINAR", demo.eliminar, lambda r: (
        f"Datos de demostración eliminados: {r['ediciones']} edición(es), {r['usuarios']} cuenta(s) y {r['votos']} voto(s)."))


@requiere_permiso("configuracion.ver", editar="configuracion.demo")
@require_POST
def cargar_demo(request):
    return accion_demo(request, "CARGAR", demo.cargar, lambda r: r or "Datos de demostración cargados.")


@requiere_permiso("configuracion.ver", editar="configuracion.editar")
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
