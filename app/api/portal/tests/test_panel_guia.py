"""El panel guía al administrador: qué sigue, qué requiere atención y acciones que se entienden por su texto."""

from votaciones.models import Categoria, Edicion, Opcion, Votacion

from .base import BasePortalTest


class GuiaPanelTest(BasePortalTest):
    def setUp(self):
        super().setUp()
        self.entrar_como_admin()

    def borrador(self, titulo="Borrador de prueba", opciones=0):
        votacion = Votacion.objects.create(
            categoria=self.categoria, titulo=titulo, descripcion="Prueba", publicada=False,
            fecha_apertura=self.votacion.fecha_apertura, fecha_cierre=self.votacion.fecha_cierre,
        )
        for numero in range(opciones):
            Opcion.objects.create(votacion=votacion, nombre=f"Opción {numero}", orden=numero)
        return votacion

    def test_el_menu_agrupa_las_secciones(self):
        respuesta = self.client.get("/panel")
        for grupo in ("Organizar", "Seguimiento", "Ajustes"):
            self.assertContains(respuesta, f'<li class="admin-nav-grupo d-none d-lg-block">{grupo}</li>')
        self.assertContains(respuesta, "Votos y resultados")

    def test_el_inicio_muestra_la_ruta_de_trabajo(self):
        respuesta = self.client.get("/panel")
        self.assertContains(respuesta, "Cómo se prepara una edición")
        self.assertEqual([p["titulo"] for p in respuesta.context["pasos"]],
                         ["Edición", "Categorías", "Votaciones", "Opciones y publicación"])

    def test_pendiente_dice_cuantas_opciones_faltan(self):
        votacion = self.borrador(opciones=1)
        respuesta = self.client.get("/panel")
        self.assertContains(respuesta, "«Borrador de prueba» necesita 1 opción más para publicarse.")
        self.assertContains(respuesta, f'href="/panel/votaciones/{votacion.pk}/opciones"')

    def test_pendiente_avisa_que_ya_se_puede_publicar(self):
        self.borrador(opciones=2)
        self.assertContains(self.client.get("/panel"), "«Borrador de prueba» está lista para publicarse.")

    def test_las_opciones_inactivas_no_cuentan_para_publicar(self):
        votacion = self.borrador(opciones=2)
        votacion.opciones.update(activa=False)
        self.assertContains(self.client.get("/panel"), "necesita 2 opciones más")

    def test_pendiente_categoria_sin_votaciones_y_pausa(self):
        Categoria.objects.create(edicion=self.edicion, nombre="Danza", slug="danza", orden=9, activa=True)
        Edicion.objects.filter(pk=self.edicion.pk).update(votaciones_pausadas=True)
        respuesta = self.client.get("/panel")
        self.assertContains(respuesta, "Categorías sin votaciones: Danza.")
        self.assertContains(respuesta, "La recepción de votos está en pausa")

    def test_todo_al_dia_sin_pendientes(self):
        self.assertContains(self.client.get("/panel"), "Todo al día")

    def test_edicion_cerrada_avisa_que_el_publico_no_la_ve(self):
        cerrada = Edicion.objects.create(nombre="Festival 2020", anio=2020, fecha_inicio="2020-04-26", fecha_fin="2020-04-30",
                                         estado=Edicion.Estado.CERRADA)
        respuesta = self.client.get(f"/panel?edicion={cerrada.pk}")
        self.assertContains(respuesta, "que no es la edición activa")
        self.assertEqual(respuesta.context["pendientes"], [])

    def test_la_accion_principal_depende_del_estado_de_la_votacion(self):
        sin_opciones = self.borrador("Sin opciones")
        lista = self.borrador("Lista para salir", opciones=2)
        respuesta = self.client.get("/panel/votaciones")
        self.assertContains(respuesta, f'aria-label="Agregar opciones a {sin_opciones.titulo}"')
        self.assertContains(respuesta, f'aria-label="Publicar {lista.titulo}"')
        self.assertNotContains(respuesta, f'aria-label="Publicar {sin_opciones.titulo}"')
        self.assertContains(respuesta, f'aria-label="Ver votos de {self.votacion.titulo}"')

    def test_opciones_ofrece_publicar_cuando_esta_lista(self):
        votacion = self.borrador(opciones=2)
        respuesta = self.client.get(f"/panel/votaciones/{votacion.pk}/opciones")
        self.assertContains(respuesta, "Lista para publicar.")
        self.assertContains(respuesta, f'action="/panel/votaciones/{votacion.pk}/publicar"')

    def test_opciones_indica_el_siguiente_paso_si_faltan(self):
        votacion = self.borrador(opciones=1)
        self.assertContains(self.client.get(f"/panel/votaciones/{votacion.pk}/opciones"), "agrega 1 opción activa más")

    def test_formularios_por_secciones(self):
        for ruta, seccion in (("/panel/votaciones/nueva", "Cuándo se puede votar"), ("/panel/categorias/nueva", "Regla de votación"),
                              ("/panel/ediciones/nueva", "Visibilidad")):
            with self.subTest(ruta):
                self.assertContains(self.client.get(ruta), seccion)

    def test_votos_resume_el_total_y_la_visibilidad(self):
        respuesta = self.client.get("/panel/votos")
        self.assertContains(respuesta, "Votos y resultados")
        self.assertContains(respuesta, "Resultados al público")
