from votaciones.models import Categoria, Edicion, Votacion

from .base import BasePortalTest

URL_VOTACION = "/2027/categorias/musica/cancion-favorita-del-publico"


class PresentacionesOpcionesTest(BasePortalTest):
    def con_presentacion(self, valor):
        Votacion.objects.filter(pk=self.votacion.pk).update(presentacion_opciones=valor)
        return self.client.get(URL_VOTACION)

    def test_colores_tipo_kahoot(self):
        respuesta = self.con_presentacion("colores")
        self.assertContains(respuesta, 'class="opciones-colores"')
        self.assertContains(respuesta, 'class="opcion-color"', count=2)

    def test_respuestas_tipo_quizizz_con_letras(self):
        respuesta = self.con_presentacion("respuestas")
        self.assertContains(respuesta, 'class="opciones-respuestas"')
        self.assertContains(respuesta, '<span class="opcion-respuesta-letra" aria-hidden="true">A</span>')
        self.assertContains(respuesta, '<span class="opcion-respuesta-letra" aria-hidden="true">B</span>')

    def test_duelo_con_vs_entre_opciones(self):
        respuesta = self.con_presentacion("duelo")
        self.assertContains(respuesta, 'class="opciones-duelo"')
        self.assertContains(respuesta, '<span class="duelo-vs" aria-hidden="true">VS</span>', count=1)

    def test_las_nuevas_presentaciones_siguen_siendo_radios_del_formulario_de_voto(self):
        for valor in ("colores", "respuestas", "duelo"):
            with self.subTest(valor):
                self.assertContains(self.con_presentacion(valor), 'form="form-voto"', count=2)


class VistaPreviaCategoriasPanelTest(BasePortalTest):
    def setUp(self):
        super().setUp()
        self.entrar_como_admin()

    def test_nueva_edicion_usa_categorias_de_ejemplo_en_todas_las_presentaciones(self):
        respuesta = self.client.get("/panel/ediciones/nueva")
        self.assertContains(respuesta, "data-vista-previa-categorias")
        self.assertContains(respuesta, "con categorías de ejemplo")
        self.assertContains(respuesta, "Categoría de ejemplo 1")
        for valor in ("tarjetas", "lista", "mosaico", "compacta", "destacada"):
            self.assertContains(respuesta, f'data-presentacion="{valor}"')

    def test_editar_muestra_las_categorias_reales_sin_enlaces(self):
        Categoria.objects.create(edicion=self.edicion, nombre="Danza", slug="danza", orden=99, activa=True)
        respuesta = self.client.get(f"/panel/ediciones/{self.edicion.pk}/editar")
        self.assertContains(respuesta, "las categorías de esta edición")
        self.assertContains(respuesta, "Danza")
        # La vista previa no saca al administrador del formulario
        self.assertNotContains(respuesta, 'href="/2027/categorias/danza"')

    def test_solo_se_ve_la_presentacion_elegida(self):
        Edicion.objects.filter(pk=self.edicion.pk).update(presentacion_categorias="mosaico")
        respuesta = self.client.get(f"/panel/ediciones/{self.edicion.pk}/editar")
        self.assertContains(respuesta, '<div data-presentacion="mosaico">')
        self.assertContains(respuesta, '<div data-presentacion="lista" hidden>')

    def test_la_pagina_publica_conserva_los_enlaces(self):
        for valor in ("tarjetas", "lista", "mosaico", "compacta", "destacada"):
            with self.subTest(valor):
                Edicion.objects.filter(pk=self.edicion.pk).update(presentacion_categorias=valor)
                self.assertContains(self.client.get("/2027"), 'href="/2027/categorias/musica"')


class VistaPreviaPanelTest(BasePortalTest):
    def test_editar_muestra_la_vista_previa_con_las_opciones_reales(self):
        self.entrar_como_admin()
        respuesta = self.client.get(f"/panel/votaciones/{self.votacion.pk}/editar")
        self.assertContains(respuesta, "data-vista-previa-opciones")
        self.assertContains(respuesta, "las opciones de esta votación")
        # Una vista previa por presentación, con id propios para no chocar entre sí
        for valor in ("tarjetas", "lista", "mosaico", "compacta", "reproductor", "colores", "respuestas", "duelo"):
            self.assertContains(respuesta, f'data-presentacion="{valor}"')
            self.assertContains(respuesta, f'id="vp-{valor}-opcion-{self.opcion_a.pk}"')

    def test_nueva_votacion_usa_opciones_de_ejemplo(self):
        self.entrar_como_admin()
        respuesta = self.client.get("/panel/votaciones/nueva")
        self.assertContains(respuesta, "con opciones de ejemplo")
        self.assertContains(respuesta, "Merengue")

    def test_se_puede_guardar_una_votacion_tipo_kahoot(self):
        self.entrar_como_admin()
        datos = {
            "categoria": self.categoria.pk, "titulo": "Final de acordeoneros", "descripcion": "Duelo final",
            "fecha_apertura": "2027-04-28T08:00", "fecha_cierre": "2027-04-30T20:00", "presentacion_opciones": "colores",
            "icono": "trophy-fill", "visibilidad_resultados": "al_cierre",
        }
        self.client.post("/panel/votaciones/nueva", datos)
        self.assertEqual(Votacion.objects.get(titulo="Final de acordeoneros").presentacion_opciones, "colores")
