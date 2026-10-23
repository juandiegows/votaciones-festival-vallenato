"""
Rutas del sitio Django (MVT). Son las mismas URL amigables de la web React:
  /{año}                                   categorías de la edición
  /{año}/categorias/{categoría}            votaciones de la categoría
  /{año}/categorias/{categoría}/{votación} detalle con opciones y resultados
El panel vive en /panel/… (no /admin: el WAF de producción bloquea esas rutas).
"""

from django.urls import path, register_converter

from .vistas import cuentas, publico, votos
from .vistas.panel import categorias, ediciones, inicio, opciones, votaciones

app_name = "portal"


class AnioConverter:
    """Año de cuatro cifras: /2027 es una edición; /login, /panel… nunca chocan con él."""

    regex = r"\d{4}"

    def to_python(self, valor):
        return int(valor)

    def to_url(self, valor):
        return str(valor)


register_converter(AnioConverter, "anio")

panel = [
    path("panel", inicio.inicio, name="panel"),
    path("panel/ediciones", ediciones.ediciones, name="panel-ediciones"),
    path("panel/ediciones/nueva", ediciones.ediciones, name="panel-edicion-nueva"),
    path("panel/ediciones/<int:pk>/editar", ediciones.ediciones, name="panel-edicion-editar"),
    path("panel/ediciones/<int:pk>/eliminar", ediciones.eliminar_edicion, name="panel-edicion-eliminar"),
    path("panel/categorias", categorias.categorias, name="panel-categorias"),
    path("panel/categorias/nueva", categorias.categorias, name="panel-categoria-nueva"),
    path("panel/categorias/<int:pk>/editar", categorias.categorias, name="panel-categoria-editar"),
    path("panel/categorias/<int:pk>/alternar", categorias.alternar_categoria, name="panel-categoria-alternar"),
    path("panel/categorias/<int:pk>/eliminar", categorias.eliminar_categoria, name="panel-categoria-eliminar"),
    path("panel/votaciones", votaciones.votaciones, name="panel-votaciones"),
    path("panel/votaciones/nueva", votaciones.votaciones, name="panel-votacion-nueva"),
    path("panel/votaciones/<int:pk>/editar", votaciones.votaciones, name="panel-votacion-editar"),
    path("panel/votaciones/<int:pk>/publicar", votaciones.publicar_votacion, name="panel-votacion-publicar"),
    path("panel/votaciones/<int:pk>/despublicar", votaciones.despublicar_votacion, name="panel-votacion-despublicar"),
    path("panel/votaciones/<int:pk>/cerrar", votaciones.cerrar_votacion, name="panel-votacion-cerrar"),
    path("panel/votaciones/<int:pk>/eliminar", votaciones.eliminar_votacion, name="panel-votacion-eliminar"),
    path("panel/votaciones/<int:votacion_pk>/opciones", opciones.opciones, name="panel-opciones"),
    path("panel/votaciones/<int:votacion_pk>/opciones/nueva", opciones.opciones, name="panel-opcion-nueva"),
    path("panel/votaciones/<int:votacion_pk>/opciones/<int:pk>/editar", opciones.opciones, name="panel-opcion-editar"),
    path("panel/votaciones/<int:votacion_pk>/opciones/<int:pk>/alternar", opciones.alternar_opcion, name="panel-opcion-alternar"),
    path("panel/votaciones/<int:votacion_pk>/opciones/<int:pk>/eliminar", opciones.eliminar_opcion, name="panel-opcion-eliminar"),
]

urlpatterns = [
    path("", publico.inicio, name="inicio"),
    path("categorias", publico.ir_a_edicion_activa, name="categorias"),
    # Cuentas (autenticación de Django con sesión)
    path("registro", cuentas.registro, name="registro"),
    path("login", cuentas.iniciar_sesion, name="login"),
    path("logout", cuentas.cerrar_sesion, name="logout"),
    path("confirmar-correo", cuentas.confirmar_correo, name="confirmar-correo"),
    path("reenviar-confirmacion", cuentas.reenviar_confirmacion, name="reenviar-confirmacion"),
    path("recuperar-clave", cuentas.recuperar_clave, name="recuperar-clave"),
    path("restablecer-clave/<uidb64>/<token>", cuentas.RestablecerClave.as_view(), name="restablecer-clave"),
    # Voto (mismas rutas que la web React y que los enlaces del correo del comprobante)
    path("mis-votos", votos.mis_votos, name="mis-votos"),
    path("completar-documento", votos.completar_documento, name="completar-documento"),
    *panel,
    # Público por edición
    path("<anio:anio>", publico.edicion, name="edicion"),
    path("<anio:anio>/categorias/<slug:categoria>", publico.categoria, name="categoria"),
    path("<anio:anio>/categorias/<slug:categoria>/<slug:votacion>", publico.votacion, name="votacion"),
    path("<anio:anio>/categorias/<slug:categoria>/<slug:votacion>/votar", votos.votar, name="votar"),
    path("<anio:anio>/categorias/<slug:categoria>/<slug:votacion>/comprobante", votos.comprobante, name="comprobante"),
]
