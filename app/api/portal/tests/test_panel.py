import re
from datetime import timedelta

from django.utils import timezone

from votaciones.auditoria.models import RegistroAuditoria
from votaciones.models import Categoria, Edicion, Opcion, Votacion, Voto
from votaciones.sitio.models import ConfiguracionSitio
from votaciones.votacion.servicios import emitir_voto

from .base import BasePortalTest


class AccesoPanelTest(BasePortalTest):
    def test_sin_sesion_va_al_login(self):
        self.assertRedirects(self.client.get("/panel/categorias"), "/login?next=/panel/categorias")

    def test_votante_recibe_403(self):
        self.client.force_login(self.votante)
        self.assertEqual(self.client.get("/panel").status_code, 403)

    def test_paginas_del_panel(self):
        self.entrar_como_admin()
        for ruta in ("/panel", "/panel/ediciones", "/panel/ediciones/nueva", "/panel/categorias", "/panel/categorias/nueva",
                     "/panel/votaciones", "/panel/votaciones/nueva", f"/panel/votaciones/{self.votacion.pk}/editar",
                     f"/panel/votaciones/{self.votacion.pk}/opciones"):
            with self.subTest(ruta=ruta):
                self.assertEqual(self.client.get(ruta).status_code, 200)


class EdicionesPanelTest(BasePortalTest):
    def setUp(self):
        super().setUp()
        self.entrar_como_admin()

    def test_crear_edicion_activa_cierra_las_demas(self):
        datos = {"nombre": "Festival de la Leyenda Vallenata 2028", "anio": 2028, "fecha_inicio": "2028-04-26",
                 "fecha_fin": "2028-04-30", "estado": "activa", "presentacion_categorias": "lista"}
        self.assertRedirects(self.client.post("/panel/ediciones/nueva", datos), "/panel/ediciones")
        self.edicion.refresh_from_db()
        self.assertEqual(self.edicion.estado, Edicion.Estado.CERRADA)
        self.assertTrue(RegistroAuditoria.objects.filter(accion="crear", entidad="edicion").exists())

    def test_fechas_invertidas(self):
        datos = {"nombre": "Festival 2028", "anio": 2028, "fecha_inicio": "2028-04-30", "fecha_fin": "2028-04-26",
                 "estado": "cerrada", "presentacion_categorias": "tarjetas"}
        respuesta = self.client.post("/panel/ediciones/nueva", datos)
        self.assertIn("fecha_fin", respuesta.context["form"].errors)

    def test_no_elimina_edicion_con_categorias(self):
        self.client.post(f"/panel/ediciones/{self.edicion.pk}/eliminar")
        self.assertTrue(Edicion.objects.filter(pk=self.edicion.pk).exists())


class CategoriasPanelTest(BasePortalTest):
    def setUp(self):
        super().setUp()
        self.entrar_como_admin()

    def test_crear_categoria_genera_slug(self):
        datos = {"edicion": self.edicion.pk, "nombre": "Canción inédita", "descripcion": "Composiciones nuevas",
                 "icono": "music-note", "orden": 2, "activa": "on"}
        self.assertRedirects(self.client.post("/panel/categorias/nueva", datos), "/panel/categorias")
        categoria = Categoria.objects.get(nombre="Canción inédita")
        self.assertEqual(categoria.slug, "cancion-inedita")
        self.assertContains(self.client.get("/2027"), "Canción inédita")

    def test_editar_y_desactivar(self):
        datos = {"edicion": self.edicion.pk, "nombre": "Música vallenata", "slug": "musica", "descripcion": "Canciones",
                 "icono": "music-note", "orden": 1, "activa": "on"}
        self.client.post(f"/panel/categorias/{self.categoria.pk}/editar", datos)
        self.client.post(f"/panel/categorias/{self.categoria.pk}/alternar")
        self.categoria.refresh_from_db()
        self.assertEqual(self.categoria.nombre, "Música vallenata")
        self.assertFalse(self.categoria.activa)

    def test_no_elimina_categoria_con_votaciones(self):
        self.client.post(f"/panel/categorias/{self.categoria.pk}/eliminar")
        self.assertTrue(Categoria.objects.filter(pk=self.categoria.pk).exists())

    def test_edicion_cerrada_no_recibe_categorias(self):
        cerrada = Edicion.objects.create(nombre="Festival 2025", anio=2025, fecha_inicio="2025-04-26",
                                         fecha_fin="2025-04-30", estado=Edicion.Estado.CERRADA)
        datos = {"edicion": cerrada.pk, "nombre": "Vieja", "descripcion": "x", "icono": "music-note", "orden": 1}
        respuesta = self.client.post("/panel/categorias/nueva", datos)
        self.assertIn("edicion", respuesta.context["form"].errors)


class VotacionesPanelTest(BasePortalTest):
    def setUp(self):
        super().setUp()
        self.entrar_como_admin()

    def datos(self, **extra):
        return {"categoria": self.categoria.pk, "titulo": "Mejor pilonera", "descripcion": "Baile tradicional",
                "icono": "people-fill", "fecha_apertura": "2027-04-28T08:00", "fecha_cierre": "2027-05-01T18:00",
                "visibilidad_resultados": "al_cierre", "presentacion_opciones": "tarjetas", **extra}

    def test_crear_votacion_como_borrador(self):
        self.assertRedirects(self.client.post("/panel/votaciones/nueva", self.datos()), "/panel/votaciones")
        votacion = Votacion.objects.get(titulo="Mejor pilonera")
        self.assertFalse(votacion.publicada)
        self.assertEqual(votacion.imagen, "https://icons.getbootstrap.com/icons/people-fill/")

    def test_no_se_publica_sin_dos_opciones(self):
        respuesta = self.client.post("/panel/votaciones/nueva", self.datos(publicada="on"))
        self.assertIn("publicada", respuesta.context["form"].errors)

    def test_cierre_antes_de_apertura(self):
        respuesta = self.client.post("/panel/votaciones/nueva", self.datos(fecha_cierre="2027-04-27T08:00"))
        self.assertIn("fecha_cierre", respuesta.context["form"].errors)

    def test_publicar_y_cerrar_con_las_reglas_de_negocio(self):
        borrador = Votacion.objects.create(categoria=self.categoria, titulo="Borrador", fecha_apertura="2027-04-28T08:00-05:00",
                                           fecha_cierre="2027-05-01T08:00-05:00")
        self.client.post(f"/panel/votaciones/{borrador.pk}/publicar")
        borrador.refresh_from_db()
        self.assertFalse(borrador.publicada)  # RN-06: sin dos opciones activas
        self.client.post(f"/panel/votaciones/{self.votacion.pk}/cerrar")
        self.votacion.refresh_from_db()
        self.assertEqual(self.votacion.estado, Votacion.Estado.CERRADA)

    def test_no_elimina_votacion_con_votos(self):
        Voto.objects.create(usuario=self.votante, votacion=self.votacion, opcion=self.opcion_a, codigo_comprobante="FLV27-AAAAAA")
        self.client.post(f"/panel/votaciones/{self.votacion.pk}/eliminar")
        self.assertTrue(Votacion.objects.filter(pk=self.votacion.pk).exists())


class OpcionesPanelTest(BasePortalTest):
    def setUp(self):
        super().setUp()
        self.entrar_como_admin()
        # RN-19: las opciones solo se gestionan antes de que la votación abra
        ahora = timezone.now()
        Votacion.objects.filter(pk=self.votacion.pk).update(
            fecha_apertura=ahora + timedelta(days=1), fecha_cierre=ahora + timedelta(days=5))
        self.base = f"/panel/votaciones/{self.votacion.pk}/opciones"

    def abrir_votacion(self):
        ahora = timezone.now()
        Votacion.objects.filter(pk=self.votacion.pk).update(fecha_apertura=ahora - timedelta(days=1))

    def test_votacion_abierta_bloquea_las_opciones(self):
        self.abrir_votacion()
        self.assertRedirects(self.client.get(f"{self.base}/nueva"), self.base)
        self.client.post(f"{self.base}/nueva", {"nombre": "Canción C", "orden": 3, "activa": "on"})
        self.assertFalse(Opcion.objects.filter(nombre="Canción C").exists())
        self.client.post(f"{self.base}/{self.opcion_a.pk}/editar", {"nombre": "Otra canción", "orden": 1, "activa": "on"})
        self.client.post(f"{self.base}/{self.opcion_a.pk}/alternar")
        self.client.post(f"{self.base}/{self.opcion_b.pk}/eliminar")
        self.opcion_a.refresh_from_db()
        self.assertEqual((self.opcion_a.nombre, self.opcion_a.activa), ("Canción A", True))
        self.assertTrue(Opcion.objects.filter(pk=self.opcion_b.pk).exists())
        self.assertContains(self.client.get(self.base), "Las opciones están bloqueadas")

    def test_votacion_programada_con_votos_bloquea_las_opciones(self):
        Voto.objects.create(usuario=self.votante, votacion=self.votacion, opcion=self.opcion_a, codigo_comprobante="FLV27-RN19AA")
        self.client.post(f"{self.base}/{self.opcion_a.pk}/editar", {"nombre": "Otra canción", "orden": 1, "activa": "on"})
        self.opcion_a.refresh_from_db()
        self.assertEqual(self.opcion_a.nombre, "Canción A")

    def test_crear_editar_y_eliminar_opcion(self):
        self.assertRedirects(self.client.post(f"{self.base}/nueva", {"nombre": "Canción C", "orden": 3, "activa": "on"}), self.base)
        opcion = Opcion.objects.get(nombre="Canción C")
        self.client.post(f"{self.base}/{opcion.pk}/editar", {"nombre": "Canción C (versión)", "orden": 3, "activa": "on"})
        opcion.refresh_from_db()
        self.assertEqual(opcion.nombre, "Canción C (versión)")
        self.client.post(f"{self.base}/{opcion.pk}/eliminar")
        self.assertFalse(Opcion.objects.filter(pk=opcion.pk).exists())

    def test_enlace_multimedia_invalido(self):
        respuesta = self.client.post(f"{self.base}/nueva", {"nombre": "Canción D", "orden": 4, "enlace_multimedia": "ftp://x"})
        self.assertIn("enlace_multimedia", respuesta.context["form"].errors)


class ConfiguracionPanelTest(BasePortalTest):
    RUTA = "/panel/configuracion"

    def test_solo_el_administrador_entra(self):
        self.assertEqual(self.client.get(self.RUTA).status_code, 302)
        self.client.force_login(self.votante)
        self.assertEqual(self.client.get(self.RUTA).status_code, 403)
        self.client.force_login(self.admin)
        for seccion, texto in (("votacion", "Pausar todas las votaciones"), ("registro", "cédula o documento"), ("privacidad", "Mínimo de votantes"),
                               ("resultados", "Cuándo se publican"), ("sitio", "Publicar Swagger")):
            self.assertContains(self.client.get(self.RUTA, {"seccion": seccion}), texto)

    def test_seccion_desconocida_abre_votacion(self):
        self.client.force_login(self.admin)
        self.assertContains(self.client.get(self.RUTA, {"seccion": "otra"}), "Pausar todas las votaciones")

    def test_cada_pestana_guarda_solo_sus_campos(self):
        self.client.force_login(self.admin)
        respuesta = self.client.post(f"{self.RUTA}?seccion=registro", {"pedir_documento": "on"})
        self.assertRedirects(respuesta, f"{self.RUTA}?seccion=registro")
        sitio = ConfiguracionSitio.obtener()
        self.assertTrue(sitio.pedir_documento)
        # Lo que no está en la pestaña no cambia, aunque el formulario no lo envíe
        self.assertTrue(sitio.mostrar_participantes)
        self.assertTrue(sitio.mostrar_swagger)
        self.assertTrue(RegistroAuditoria.objects.filter(entidad="configuracion", usuario=self.admin).exists())

    def test_pausar_y_resultados_aplican_a_la_edicion(self):
        self.client.force_login(self.admin)
        self.client.post(f"{self.RUTA}?seccion=votacion", {"votaciones_pausadas": "on"})
        self.client.post(f"{self.RUTA}?seccion=resultados", {"visibilidad_resultados": "tiempo_real", "dias_visible_cerradas": "3"})
        self.edicion.refresh_from_db()
        self.assertTrue(self.edicion.votaciones_pausadas)
        self.assertEqual(self.edicion.visibilidad_resultados, "tiempo_real")
        self.assertEqual(ConfiguracionSitio.obtener().dias_visible_cerradas, 3)

    def test_valida_el_minimo_de_votantes(self):
        self.client.force_login(self.admin)
        respuesta = self.client.post(f"{self.RUTA}?seccion=privacidad", {"mostrar_participantes": "on", "umbral_participacion": 1})
        self.assertEqual(respuesta.status_code, 200)
        self.assertContains(respuesta, "Revisa los campos marcados")
        self.assertEqual(ConfiguracionSitio.obtener().umbral_participacion, 10)

    def test_voto_unico_se_cambia_sin_votos_y_se_bloquea_con_votos(self):
        self.client.force_login(self.admin)
        sin_votos = Categoria.objects.create(edicion=self.edicion, nombre="Sin votos")
        self.client.post(f"{self.RUTA}/categorias/{sin_votos.pk}/voto-unico")
        sin_votos.refresh_from_db()
        self.assertFalse(sin_votos.voto_unico)
        emitir_voto(self.votante, self.votacion.pk, self.opcion_a.pk)
        self.client.post(f"{self.RUTA}/categorias/{self.categoria.pk}/voto-unico")
        self.categoria.refresh_from_db()
        self.assertTrue(self.categoria.voto_unico)


class DetalleVotacionesTest(BasePortalTest):
    def setUp(self):
        super().setUp()
        self.voto = emitir_voto(self.votante, self.votacion.pk, self.opcion_a.pk)
        self.ruta = f"/panel/votos/{self.votacion.pk}"

    def test_lista_las_votaciones_con_sus_votos(self):
        self.client.force_login(self.admin)
        respuesta = self.client.get("/panel/votos")
        self.assertContains(respuesta, self.votacion.titulo)
        self.assertContains(respuesta, self.ruta)

    def test_muestra_conteos_y_no_el_voto_de_cada_persona(self):
        self.client.force_login(self.admin)
        respuesta = self.client.get(self.ruta)
        self.assertContains(respuesta, self.opcion_a.nombre)
        self.assertContains(respuesta, self.voto.codigo_comprobante)
        # Con menos de 10 votantes en una votación abierta, la lista de participantes sigue oculta
        self.assertNotContains(respuesta, self.votante.email)

    def test_buscar_comprobante(self):
        self.client.force_login(self.admin)
        self.assertContains(self.client.get(self.ruta, {"codigo": self.voto.codigo_comprobante}), self.voto.codigo_comprobante)
        self.assertNotContains(self.client.get(self.ruta, {"codigo": "NOEXISTE"}), self.voto.codigo_comprobante)

    def test_con_pocos_votos_no_muestra_participantes_aunque_este_cerrada(self):
        self.votacion.cerrada_manualmente = True
        self.votacion.save()
        self.client.force_login(self.admin)
        self.assertNotContains(self.client.get(self.ruta), self.votante.email)

    def test_el_minimo_de_votantes_se_configura(self):
        ConfiguracionSitio.objects.update_or_create(pk=1, defaults={"umbral_participacion": 1})
        self.votacion.cerrada_manualmente = True
        self.votacion.save()
        self.client.force_login(self.admin)
        respuesta = self.client.get(self.ruta)
        self.assertContains(respuesta, self.votante.email)
        self.assertContains(respuesta, self.voto.codigo_comprobante)
        # Voto secreto: ninguna fila junta al votante con el comprobante o la opción
        html = respuesta.content.decode()
        for fila in re.findall(r"<(?:tr|li)\b.*?</(?:tr|li)>", html, flags=re.S):
            if self.votante.email in fila:
                self.assertNotIn(self.voto.codigo_comprobante, fila)
                self.assertNotIn(self.opcion_a.nombre, fila)

    def test_la_lista_de_participantes_se_puede_apagar(self):
        ConfiguracionSitio.objects.update_or_create(pk=1, defaults={"umbral_participacion": 1, "mostrar_participantes": False})
        self.votacion.cerrada_manualmente = True
        self.votacion.save()
        self.client.force_login(self.admin)
        respuesta = self.client.get(self.ruta)
        self.assertNotContains(respuesta, self.votante.email)
        self.assertContains(respuesta, "ocultó la lista")

    def test_el_votante_no_entra(self):
        self.client.force_login(self.votante)
        self.assertEqual(self.client.get("/panel/votos").status_code, 403)
        self.assertEqual(self.client.get(self.ruta).status_code, 403)

    def test_django_admin_no_cruza_votante_y_opcion(self):
        self.client.force_login(self.admin)
        lista = self.client.get("/django-admin/votaciones/voto/")
        ficha = self.client.get(f"/django-admin/votaciones/voto/{self.voto.pk}/change/")
        for respuesta in (lista, ficha):
            self.assertContains(respuesta, self.voto.codigo_comprobante)
            self.assertNotContains(respuesta, self.votante.email)
        self.assertNotContains(self.client.get("/django-admin/votaciones/voto/", {"q": self.votante.email}), self.voto.codigo_comprobante)


class DjangoAdminTest(BasePortalTest):
    """El enlace «Django Admin» del panel entra con la misma sesión del sitio."""

    def test_sin_sesion_va_al_login_del_sitio(self):
        respuesta = self.client.get("/django-admin/", follow=True)
        self.assertEqual(respuesta.redirect_chain[-1][0], "/login?next=/django-admin/")
        self.assertEqual(respuesta.status_code, 200)

    def test_administrador_del_panel_entra_y_ve_los_modelos(self):
        self.admin.is_staff = False
        self.admin.save(update_fields=["is_staff"])
        self.entrar_como_admin()
        respuesta = self.client.get("/django-admin/")
        self.assertEqual(respuesta.status_code, 200)
        self.assertNotContains(respuesta, "No cuenta con permiso")
        self.assertEqual(self.client.get("/django-admin/votaciones/votacion/").status_code, 200)

    def test_votos_y_auditoria_son_de_solo_lectura(self):
        self.entrar_como_admin()
        self.assertEqual(self.client.get("/django-admin/votaciones/voto/add/").status_code, 403)
        self.assertEqual(self.client.get("/django-admin/votaciones/registroauditoria/add/").status_code, 403)

    def test_votante_no_entra(self):
        self.client.force_login(self.votante)
        self.assertNotEqual(self.client.get("/django-admin/").status_code, 200)
