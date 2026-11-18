"""Pantallas del panel Django para el sitio público (banner, revista, contacto y redes, identidad visual) y la auditoría."""

import io
import os

from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from votaciones.auditoria.models import RegistroAuditoria
from votaciones.sitio.models import BannerInicio, ConfiguracionSitio, RedSocial, Revista

from .base import BasePortalTest


def imagen_png(nombre="banner.png"):
    contenido = io.BytesIO()
    Image.new("RGB", (20, 10), "#DD3333").save(contenido, "PNG")
    return SimpleUploadedFile(nombre, contenido.getvalue(), content_type="image/png")


def pdf(nombre="revista.pdf"):
    return SimpleUploadedFile(nombre, b"%PDF-1.4\n%prueba\n", content_type="application/pdf")


class PantallasTest(BasePortalTest):
    def test_solo_el_administrador_entra(self):
        for ruta in ("/panel/banner", "/panel/revista", "/panel/sitio", "/panel/marca", "/panel/auditoria"):
            with self.subTest(ruta=ruta):
                self.assertEqual(self.client.get(ruta).status_code, 302)
        self.client.force_login(self.votante)
        self.assertEqual(self.client.get("/panel/revista").status_code, 403)

    def test_paginas_y_menu(self):
        self.entrar_como_admin()
        for ruta in ("/panel/banner", "/panel/banner/nuevo", "/panel/revista", "/panel/revista/nueva", "/panel/sitio",
                     "/panel/marca", "/panel/auditoria", "/panel/auditoria?pestana=autoria", "/panel/auditoria?pestana=acciones"):
            with self.subTest(ruta=ruta):
                self.assertEqual(self.client.get(ruta).status_code, 200)
        menu = self.client.get("/panel").content.decode()
        for texto in ("Banner de inicio", "Revista", "Contacto y redes", "Identidad visual", "Auditoría"):
            self.assertIn(texto, menu)


class BannerTest(BasePortalTest):
    def setUp(self):
        super().setUp()
        self.entrar_como_admin()

    def test_crear_editar_mover_y_eliminar(self):
        datos = {"texto_alternativo": "Tarima del Festival", "titulo": "", "subtitulo": "", "texto_boton": "",
                 "enlace_boton": "/2027", "activo": "on"}
        self.assertRedirects(self.client.post("/panel/banner/nuevo", {**datos, "imagen": imagen_png()}), "/panel/banner")
        self.client.post("/panel/banner/nuevo", {**datos, "texto_alternativo": "Acordeón", "imagen": imagen_png("b2.png")})
        primero, segundo = BannerInicio.objects.order_by("orden")
        self.assertEqual((primero.edicion, primero.orden, segundo.orden), (self.edicion, 1, 2))
        self.client.post(f"/panel/banner/{segundo.pk}/mover", {"direccion": "subir"})
        segundo.refresh_from_db()
        self.assertEqual(segundo.orden, 1)
        self.client.post(f"/panel/banner/{primero.pk}/alternar")
        primero.refresh_from_db()
        self.assertFalse(primero.activo)
        self.client.post(f"/panel/banner/{primero.pk}/editar", {**datos, "titulo": "Bienvenidos"})
        primero.refresh_from_db()
        self.assertEqual(primero.titulo, "Bienvenidos")
        self.client.post(f"/panel/banner/{primero.pk}/eliminar")
        self.assertFalse(BannerInicio.objects.filter(pk=primero.pk).exists())
        self.assertTrue(RegistroAuditoria.objects.filter(entidad="banner", accion="eliminar").exists())

    def test_valida_imagen_y_enlace(self):
        respuesta = self.client.post("/panel/banner/nuevo", {"texto_alternativo": "", "enlace_boton": "javascript:alert(1)"})
        errores = respuesta.context["form"].errors
        self.assertIn("imagen", errores)
        self.assertIn("texto_alternativo", errores)
        self.assertIn("enlace_boton", errores)

    def test_cambia_el_modo(self):
        self.client.post("/panel/banner/modo", {"modo_banner": "fijo"})
        self.assertEqual(ConfiguracionSitio.obtener().modo_banner, "fijo")


class RevistaTest(BasePortalTest):
    def setUp(self):
        super().setUp()
        self.entrar_como_admin()

    def test_subir_y_cambiar_la_revista(self):
        datos = {"titulo": "Revista 2027", "descripcion": "", "activa": "on", "archivo": pdf()}
        self.assertRedirects(self.client.post("/panel/revista/nueva", datos), "/panel/revista")
        revista = Revista.objects.get()
        anterior = revista.archivo.name
        self.client.post(f"/panel/revista/{revista.pk}/editar",
                         {"titulo": "Revista 2027 · edición 2", "activa": "on", "archivo": pdf("nueva.pdf")})
        revista.refresh_from_db()
        self.assertEqual(revista.titulo, "Revista 2027 · edición 2")
        self.assertNotEqual(revista.archivo.name, anterior)
        self.assertFalse(revista.archivo.storage.exists(anterior))
        self.assertContains(self.client.get("/panel/revista"), "En el inicio")

    def test_rechaza_lo_que_no_es_pdf(self):
        falso = SimpleUploadedFile("revista.pdf", b"no es un pdf", content_type="application/pdf")
        respuesta = self.client.post("/panel/revista/nueva", {"titulo": "Revista", "archivo": falso})
        self.assertIn("archivo", respuesta.context["form"].errors)
        self.assertFalse(Revista.objects.exists())


class SitioTest(BasePortalTest):
    def setUp(self):
        super().setUp()
        self.entrar_como_admin()

    def test_contacto_y_redes(self):
        datos = {"formulario": "contacto", "nombre_organizacion": "Fundación", "telefono": "300", "direccion": "Valledupar",
                 "correo": "contacto@festival.test", "texto_pie": "", "aviso_superior": "", "subtitulo_logo": "", "texto_acerca": ""}
        self.assertRedirects(self.client.post("/panel/sitio", datos), "/panel/sitio")
        configuracion = ConfiguracionSitio.obtener()
        self.assertEqual(configuracion.correo, "contacto@festival.test")
        self.assertFalse(configuracion.mostrar_equipo)
        self.client.post("/panel/sitio", {"formulario": "red", "icono": "instagram", "nombre": "Instagram",
                                          "url": "https://instagram.com/festival", "activa": "on"})
        red = RedSocial.objects.get()
        self.client.post(f"/panel/sitio/redes/{red.pk}/editar",
                         {"formulario": "red", "icono": "instagram", "nombre": "IG", "url": "https://instagram.com/flv"})
        red.refresh_from_db()
        self.assertEqual((red.nombre, red.activa), ("IG", False))
        self.client.post(f"/panel/sitio/redes/{red.pk}/eliminar")
        self.assertFalse(RedSocial.objects.exists())

    def test_interruptor_oculta_el_texto_sin_borrarlo(self):
        respuesta = self.client.get("/panel/sitio")
        self.assertContains(respuesta, 'name="mostrar_aviso_superior"')
        self.assertContains(respuesta, "Visible en el sitio.")
        datos = {"formulario": "contacto", "nombre_organizacion": "Fundación", "telefono": "300", "direccion": "Valledupar",
                 "correo": "contacto@festival.test", "texto_pie": "Pie", "aviso_superior": "Aviso oculto", "subtitulo_logo": "Sub",
                 "texto_acerca": "Acerca", "mostrar_texto_pie": "on", "mostrar_subtitulo_logo": "on", "mostrar_texto_acerca": "on"}
        self.client.post("/panel/sitio", datos)
        configuracion = ConfiguracionSitio.obtener()
        self.assertEqual(configuracion.aviso_superior, "Aviso oculto")
        self.assertFalse(configuracion.mostrar_aviso_superior)
        self.assertTrue(configuracion.mostrar_texto_pie)
        self.assertContains(self.client.get("/panel/sitio"), "Oculto en el sitio")
        self.assertNotContains(self.client.get("/"), "Aviso oculto")

    def test_url_invalida(self):
        respuesta = self.client.post("/panel/sitio", {"formulario": "red", "icono": "globe", "nombre": "Web", "url": "festival"})
        self.assertIn("url", respuesta.context["form_red"].errors)


class MarcaTest(BasePortalTest):
    def setUp(self):
        super().setUp()
        self.entrar_como_admin()

    def datos(self, **cambios):
        form = self.client.get("/panel/marca").context["form"]
        iniciales = {nombre: campo.initial for nombre, campo in form.fields.items() if campo.initial not in (False, None)}
        return {**iniciales, **cambios}

    def test_guarda_solo_lo_que_cambia_y_se_restablece(self):
        self.client.post("/panel/marca", self.datos(color_rojo="#C62828", primario_forma="pildora"))
        marca = ConfiguracionSitio.obtener().marca
        self.assertEqual(marca, {"colores": {"--flv-rojo": "#C62828"}, "botones": {"primario": {"forma": "pildora"}}})
        self.assertIn("--flv-rojo:#C62828", self.client.get("/").content.decode())
        self.client.post("/panel/marca/restablecer")
        self.assertEqual(ConfiguracionSitio.obtener().marca, {})

    def test_conserva_el_color_propio_de_los_botones(self):
        ConfiguracionSitio.obtener()
        ConfiguracionSitio.objects.filter(pk=1).update(marca={"botones": {"primario": {"color": "#000000"}}})
        self.client.post("/panel/marca", self.datos(primario_peso="800"))
        self.assertEqual(ConfiguracionSitio.obtener().marca["botones"]["primario"], {"color": "#000000", "peso": "800"})

    def test_color_invalido(self):
        respuesta = self.client.post("/panel/marca", self.datos(color_rojo="rojo"))
        self.assertEqual(respuesta.status_code, 200)
        self.assertContains(respuesta, "is-invalid")
        self.assertEqual(ConfiguracionSitio.obtener().marca, {})


class LogoPanelTest(BasePortalTest):
    def setUp(self):
        super().setUp()
        self.entrar_como_admin()

    def subir(self, archivo=None, alt="Logo de prueba"):
        datos = {"formulario": "logo", "logo_texto_alternativo": alt}
        if archivo is not None:
            datos["logo"] = archivo
        return self.client.post("/panel/marca", datos)

    def test_subir_reemplazar_y_quitar_el_logo(self):
        self.assertContains(self.client.get("/"), 'viewBox="0 0 64 64"')  # logo por defecto
        self.assertRedirects(self.subir(imagen_png("logo.png")), "/panel/marca")
        configuracion = ConfiguracionSitio.obtener()
        primero = configuracion.logo.path
        inicio = self.client.get("/").content.decode()
        self.assertIn(f'class="navbar-logo" src="{configuracion.logo.url}" alt="Logo de prueba"', inicio)
        self.assertIn(f'rel="icon" href="{configuracion.logo.url}"', inicio)
        self.assertTrue(RegistroAuditoria.objects.filter(entidad="configuracion", detalle__seccion="logo").exists())

        # Solo el texto alternativo: el archivo se conserva
        self.subir(alt="Acordeón")
        configuracion.refresh_from_db()
        self.assertEqual((configuracion.logo.path, configuracion.logo_texto_alternativo), (primero, "Acordeón"))

        self.subir(imagen_png("otro.png"))
        configuracion.refresh_from_db()
        self.assertNotEqual(configuracion.logo.path, primero)
        self.assertFalse(os.path.exists(primero))
        segundo = configuracion.logo.path

        self.assertRedirects(self.client.post("/panel/marca/quitar-logo"), "/panel/marca")
        self.assertFalse(ConfiguracionSitio.obtener().logo)
        self.assertFalse(os.path.exists(segundo))
        self.assertContains(self.client.get("/"), 'viewBox="0 0 64 64"')

    def test_rechaza_svg_y_exige_archivo_la_primera_vez(self):
        svg = SimpleUploadedFile("logo.svg", b"<svg xmlns='http://www.w3.org/2000/svg'/>", content_type="image/svg+xml")
        respuesta = self.subir(svg)
        self.assertEqual(respuesta.status_code, 200)
        self.assertContains(respuesta, "is-invalid")
        self.assertContains(self.subir(), "Selecciona la imagen del logo.")
        self.assertFalse(ConfiguracionSitio.obtener().logo)

    def test_sin_sitio_editar_no_cambia_el_logo(self):
        from votaciones.models import Usuario

        self.client.force_login(Usuario.objects.create_user(
            "lectura@festival.test", "Clave2027*segura", nombres="L", apellidos="L", rol=Usuario.Rol.LECTURA,
            acepta_tratamiento_datos=True, correo_verificado=True))
        self.assertEqual(self.client.get("/panel/marca").status_code, 200)
        self.assertEqual(self.subir(imagen_png("logo.png")).status_code, 403)
        self.assertEqual(self.client.post("/panel/marca/quitar-logo").status_code, 403)
        self.assertFalse(ConfiguracionSitio.obtener().logo)


class ValoresPorDefectoPanelTest(BasePortalTest):
    RUTA = "/panel/configuracion/predeterminados"

    def setUp(self):
        super().setUp()
        self.entrar_como_admin()

    def test_se_guardan_y_se_usan_al_crear(self):
        self.assertContains(self.client.get(self.RUTA), "Edición nueva")
        datos = {"defecto_presentacion_categorias": "mosaico", "defecto_visibilidad_resultados": "no_publicar",
                 "defecto_categoria_activa": "on", "defecto_presentacion_opciones": "lista", "defecto_dias_votacion": "10"}
        self.assertRedirects(self.client.post(self.RUTA, datos), self.RUTA)
        configuracion = ConfiguracionSitio.obtener()
        self.assertFalse(configuracion.defecto_voto_unico)
        self.assertEqual(configuracion.defecto_dias_votacion, 10)
        nueva_edicion = self.client.get("/panel/ediciones/nueva").context["form"]
        self.assertEqual(nueva_edicion.initial["presentacion_categorias"], "mosaico")
        self.assertEqual(nueva_edicion.instance.visibilidad_resultados, "no_publicar")
        self.assertFalse(self.client.get("/panel/categorias/nueva").context["form"].initial["voto_unico"])
        inicial = self.client.get("/panel/votaciones/nueva").context["form"].initial
        self.assertEqual(inicial["presentacion_opciones"], "lista")
        self.assertEqual((inicial["fecha_cierre"] - inicial["fecha_apertura"]).days, 10)

    def test_dias_fuera_de_rango(self):
        respuesta = self.client.post(self.RUTA, {"defecto_presentacion_categorias": "tarjetas", "defecto_visibilidad_resultados": "al_cierre",
                                                 "defecto_presentacion_opciones": "tarjetas", "defecto_dias_votacion": "0"})
        self.assertEqual(respuesta.status_code, 200)
        self.assertIn("defecto_dias_votacion", respuesta.context["form"].errors)

    def test_modo_del_servidor_solo_lectura(self):
        respuesta = self.client.get("/panel/configuracion/sitio")
        self.assertContains(respuesta, "Modo del servidor")
        self.assertContains(respuesta, "DJANGO_DEBUG")
        self.assertNotContains(respuesta, 'name="debug"')


class AuditoriaTest(BasePortalTest):
    def setUp(self):
        super().setUp()
        self.entrar_como_admin()

    def test_pestanas(self):
        self.assertContains(self.client.get("/panel/auditoria"), "Todo cuadra.")
        self.assertContains(self.client.get("/panel/auditoria?pestana=autoria"), "Canción favorita del público")
        self.client.post(f"/panel/categorias/{self.categoria.pk}/alternar")
        acciones = self.client.get("/panel/auditoria?pestana=acciones")
        self.assertContains(acciones, "Desactivó la categoría «Música»")
        self.assertContains(acciones, "admin@festival.test")
        self.assertNotContains(self.client.get("/panel/auditoria?pestana=acciones&entidad=banner"), "«Música»")
