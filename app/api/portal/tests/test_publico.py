from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

from votaciones.models import Categoria, Edicion, Revista, Votacion

from .base import BasePortalTest


class SitioPublicoTest(BasePortalTest):
    def test_inicio_muestra_la_edicion_activa_y_sus_votaciones_abiertas(self):
        respuesta = self.client.get("/")
        self.assertContains(respuesta, "Festival de la Leyenda Vallenata 2027")
        self.assertContains(respuesta, "Canción favorita del público")
        self.assertTemplateUsed(respuesta, "portal/inicio.html")

    def test_inicio_muestra_la_revista_como_libro(self):
        Revista.objects.create(titulo="Revista 2027", archivo=SimpleUploadedFile("revista.pdf", b"%PDF-1.4"))
        respuesta = self.client.get("/")
        self.assertContains(respuesta, "data-revista-libro")
        self.assertContains(respuesta, "portal/libs/pdfjs/pdf.min.mjs")
        self.assertContains(respuesta, "portal/js/revista-libro.js")
        self.assertNotContains(respuesta, "<iframe")

    def test_inicio_sin_edicion_activa(self):
        Edicion.objects.update(estado=Edicion.Estado.CERRADA)
        self.assertTemplateUsed(self.client.get("/"), "portal/sin_edicion.html")

    def test_categorias_redirige_a_la_edicion_activa(self):
        self.assertRedirects(self.client.get("/categorias"), "/2027")

    def test_categorias_de_la_edicion_leidas_de_la_base_de_datos(self):
        Categoria.objects.create(edicion=self.edicion, nombre="Piloneras", descripcion="Baile", orden=2)
        respuesta = self.client.get("/2027")
        self.assertContains(respuesta, "Música")
        self.assertContains(respuesta, "Piloneras")

    def test_edicion_cerrada_no_se_muestra(self):
        Edicion.objects.create(nombre="Festival 2025", anio=2025, fecha_inicio="2025-04-26", fecha_fin="2025-04-30",
                               estado=Edicion.Estado.CERRADA)
        self.assertEqual(self.client.get("/2025").status_code, 404)

    def test_categoria_inactiva_no_se_muestra(self):
        self.categoria.activa = False
        self.categoria.save()
        self.assertEqual(self.client.get("/2027/categorias/musica").status_code, 404)

    def test_votaciones_de_la_categoria_con_filtro_por_estado(self):
        ahora = timezone.now()
        Votacion.objects.create(categoria=self.categoria, titulo="Votación futura", publicada=True,
                                fecha_apertura=ahora + timedelta(days=3), fecha_cierre=ahora + timedelta(days=9))
        todas = self.client.get("/2027/categorias/musica")
        self.assertContains(todas, "Votación futura")
        abiertas = self.client.get("/2027/categorias/musica?estado=abierta")
        self.assertContains(abiertas, "Canción favorita del público")
        self.assertNotContains(abiertas, "Votación futura")

    def test_detalle_muestra_las_opciones(self):
        respuesta = self.client.get("/2027/categorias/musica/cancion-favorita-del-publico")
        self.assertContains(respuesta, "Canción A")
        self.assertContains(respuesta, "Canción B")

    def test_borrador_solo_lo_ve_la_administracion(self):
        self.votacion.publicada = False
        self.votacion.save()
        ruta = "/2027/categorias/musica/cancion-favorita-del-publico"
        self.assertEqual(self.client.get(ruta).status_code, 404)
        self.entrar_como_admin()
        self.assertContains(self.client.get(ruta), "Vista previa de administrador")

    def test_resultados_en_tiempo_real_visibles(self):
        self.votacion.personalizar_resultados = True
        self.votacion.visibilidad_resultados = Votacion.Visibilidad.TIEMPO_REAL
        self.votacion.save()
        respuesta = self.client.get("/2027/categorias/musica/cancion-favorita-del-publico")
        self.assertIsNotNone(respuesta.context["resultados"])

    def test_resultados_al_cierre_ocultos_mientras_esta_abierta(self):
        respuesta = self.client.get("/2027/categorias/musica/cancion-favorita-del-publico")
        self.assertIsNone(respuesta.context["resultados"])
        self.assertContains(respuesta, "Los resultados se publicarán cuando la votación cierre.")

    def test_la_api_sigue_funcionando_junto_al_sitio(self):
        self.assertEqual(self.client.get("/api/salud/").json(), {"estado": "ok"})
