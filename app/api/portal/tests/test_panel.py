from votaciones.auditoria.models import RegistroAuditoria
from votaciones.models import Categoria, Edicion, Opcion, Votacion, Voto

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
                     f"/panel/votaciones/{self.votacion.pk}/opciones", f"/panel/votaciones/{self.votacion.pk}/opciones/nueva"):
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
                "votos_por_usuario": 1, "visibilidad_resultados": "al_cierre", "presentacion_opciones": "tarjetas", **extra}

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
        self.base = f"/panel/votaciones/{self.votacion.pk}/opciones"

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
