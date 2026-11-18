"""
Rutas del sitio Django (MVT). Son las mismas URL amigables de la web React:
  /{año}                                   categorías de la edición
  /{año}/categorias/{categoría}            votaciones de la categoría
  /{año}/categorias/{categoría}/{votación} detalle con opciones y resultados
El panel vive en /panel/… (no /admin: el WAF de producción bloquea esas rutas).
"""

from django.urls import path, register_converter

from .vistas import cuentas, publico, seguridad, votos
from .vistas.panel import (
    auditoria, categorias, configuracion, ediciones, inicio, opciones, registros, roles, sitio, transferencia, usuarios,
    votaciones,
)
from .vistas.panel import votos as votos_panel

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
    path("panel/ediciones/plantilla", transferencia.plantilla, name="panel-edicion-plantilla"),
    path("panel/ediciones/importar", transferencia.importar, name="panel-edicion-importar"),
    path("panel/ediciones/<int:pk>/estructura", transferencia.estructura, name="panel-edicion-estructura"),
    path("panel/exportar/<str:tipo>/<int:pk>/<str:formato>", transferencia.exportar, name="panel-exportar"),
    path("panel/ediciones/<int:pk>/editar", ediciones.ediciones, name="panel-edicion-editar"),
    path("panel/ediciones/<int:pk>/eliminar", ediciones.eliminar_edicion, name="panel-edicion-eliminar"),
    path("panel/categorias", categorias.categorias, name="panel-categorias"),
    path("panel/categorias/nueva", categorias.categorias, name="panel-categoria-nueva"),
    path("panel/categorias/<int:pk>/editar", categorias.categorias, name="panel-categoria-editar"),
    path("panel/categorias/<int:pk>/alternar", categorias.alternar_categoria, name="panel-categoria-alternar"),
    path("panel/categorias/<int:pk>/eliminar", categorias.eliminar_categoria, name="panel-categoria-eliminar"),
    path("panel/configuracion", configuracion.configuracion, name="panel-configuracion"),
    path("panel/configuracion/<slug:clave>", configuracion.configuracion, name="panel-configuracion-seccion"),
    path("panel/configuracion/categorias/<int:pk>/voto-unico", configuracion.alternar_voto_unico, name="panel-config-voto-unico"),
    path("panel/configuracion/demo/eliminar", configuracion.eliminar_demo, name="panel-demo-eliminar"),
    path("panel/configuracion/demo/cargar", configuracion.cargar_demo, name="panel-demo-cargar"),
    path("panel/votos", votos_panel.votos, name="panel-votos"),
    path("panel/votos/<int:pk>", votos_panel.detalle, name="panel-voto-detalle"),
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
    # Seguimiento
    path("panel/auditoria", auditoria.auditoria, name="panel-auditoria"),
    path("panel/registros", registros.registros, name="panel-registros"),
    path("panel/registros/probar", registros.probar, name="panel-registros-probar"),
    path("panel/usuarios", usuarios.usuarios, name="panel-usuarios"),
    path("panel/usuarios/<int:pk>/rol", usuarios.cambiar_rol, name="panel-usuario-rol"),
    path("panel/usuarios/<int:pk>/quitar-2fa", usuarios.quitar_2fa, name="panel-usuario-quitar-2fa"),
    path("panel/roles", roles.roles, name="panel-roles"),
    path("panel/roles/nuevo", roles.roles, name="panel-rol-nuevo"),
    path("panel/roles/<int:pk>/editar", roles.roles, name="panel-rol-editar"),
    path("panel/roles/<int:pk>/eliminar", roles.eliminar_rol, name="panel-rol-eliminar"),
    # Sitio público
    path("panel/banner", sitio.banners, name="panel-banner"),
    path("panel/banner/nuevo", sitio.banners, name="panel-banner-nuevo"),
    path("panel/banner/modo", sitio.modo_banner, name="panel-banner-modo"),
    path("panel/banner/<int:pk>/editar", sitio.banners, name="panel-banner-editar"),
    path("panel/banner/<int:pk>/alternar", sitio.alternar_banner, name="panel-banner-alternar"),
    path("panel/banner/<int:pk>/mover", sitio.mover_banner, name="panel-banner-mover"),
    path("panel/banner/<int:pk>/eliminar", sitio.eliminar_banner, name="panel-banner-eliminar"),
    path("panel/revista", sitio.revistas, name="panel-revista"),
    path("panel/revista/nueva", sitio.revistas, name="panel-revista-nueva"),
    path("panel/revista/<int:pk>/editar", sitio.revistas, name="panel-revista-editar"),
    path("panel/revista/<int:pk>/alternar", sitio.alternar_revista, name="panel-revista-alternar"),
    path("panel/revista/<int:pk>/mover", sitio.mover_revista, name="panel-revista-mover"),
    path("panel/revista/<int:pk>/eliminar", sitio.eliminar_revista, name="panel-revista-eliminar"),
    path("panel/sitio", sitio.sitio, name="panel-sitio"),
    path("panel/sitio/redes/<int:pk>/editar", sitio.sitio, name="panel-red-editar"),
    path("panel/sitio/redes/<int:pk>/mover", sitio.mover_red, name="panel-red-mover"),
    path("panel/sitio/redes/<int:pk>/eliminar", sitio.eliminar_red, name="panel-red-eliminar"),
    path("panel/marca", sitio.marca, name="panel-marca"),
    path("panel/marca/restablecer", sitio.restablecer_marca, name="panel-marca-restablecer"),
    path("panel/marca/quitar-logo", sitio.quitar_logo, name="panel-marca-quitar-logo"),
]

urlpatterns = [
    path("", publico.inicio, name="inicio"),
    path("categorias", publico.ir_a_edicion_activa, name="categorias"),
    path("equipo", publico.equipo, name="equipo"),
    # Cuentas (autenticación de Django con sesión)
    path("registro", cuentas.registro, name="registro"),
    path("login", cuentas.iniciar_sesion, name="login"),
    path("logout", cuentas.cerrar_sesion, name="logout"),
    path("confirmar-correo", cuentas.confirmar_correo, name="confirmar-correo"),
    path("reenviar-confirmacion", cuentas.reenviar_confirmacion, name="reenviar-confirmacion"),
    path("revisa-tu-correo", cuentas.revisa_tu_correo, name="revisa-tu-correo"),
    path("recuperar-clave", cuentas.recuperar_clave, name="recuperar-clave"),
    path("restablecer-clave/<uidb64>/<token>", cuentas.RestablecerClave.as_view(), name="restablecer-clave"),
    # Verificación en dos pasos (RF-20)
    path("verificar-acceso", seguridad.verificar_acceso, name="verificar-acceso"),
    path("cuenta/seguridad", seguridad.seguridad, name="seguridad"),
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
