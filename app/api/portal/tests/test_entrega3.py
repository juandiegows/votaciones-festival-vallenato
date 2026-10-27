"""
Pruebas funcionales obligatorias de la Entrega 3 (CP-01 a CP-10) sobre el sitio Django y GET /api/categorias/.

Regla central (RN-04): un usuario elige una sola opción por categoría y edición; puede votar en otras categorías,
pero no emitir un segundo voto en la misma categoría aunque esta tenga varias votaciones (subeventos).
"""

import json
import threading
from datetime import timedelta
from unittest import mock, skipUnless

from django.db import connection, connections
from django.test import TransactionTestCase, override_settings
from django.utils import timezone

from votaciones.models import Categoria, Opcion, Usuario, Votacion, Voto

from .base import CLAVE_VOTANTE, BasePortalTest

URL_CANCION = "/2027/categorias/musica/cancion-favorita-del-publico"
URL_INEDITA = "/2027/categorias/musica/cancion-inedita-revelacion"
URL_COMPARSA = "/2027/categorias/piloneras/mejor-comparsa"


class Entrega3Mixin:
    """Música con dos votaciones abiertas (subeventos) y Piloneras con una."""

    def crear_escenario(self):
        ahora = timezone.now()
        self.inedita = Votacion.objects.create(
            categoria=self.categoria, titulo="Canción inédita revelación", descripcion="Inéditas",
            fecha_apertura=ahora - timedelta(days=1), fecha_cierre=ahora + timedelta(days=5), publicada=True,
        )
        self.inedita_a = Opcion.objects.create(votacion=self.inedita, nombre="Inédita A", orden=1)
        Opcion.objects.create(votacion=self.inedita, nombre="Inédita B", orden=2)
        self.piloneras = Categoria.objects.create(edicion=self.edicion, nombre="Piloneras", descripcion="Comparsas", orden=2)
        self.comparsa = Votacion.objects.create(
            categoria=self.piloneras, titulo="Mejor comparsa", descripcion="Comparsas",
            fecha_apertura=ahora - timedelta(days=1), fecha_cierre=ahora + timedelta(days=5), publicada=True,
        )
        self.comparsa_a = Opcion.objects.create(votacion=self.comparsa, nombre="Comparsa A", orden=1)
        Opcion.objects.create(votacion=self.comparsa, nombre="Comparsa B", orden=2)


class PruebasEntrega3(Entrega3Mixin, BasePortalTest):
    def setUp(self):
        super().setUp()
        self.crear_escenario()

    def votar(self, url, opcion):
        return self.client.post(f"{url}/votar", {"opcion": opcion.pk})

    def test_cp01_usuario_autenticado_registra_un_voto_valido(self):
        self.client.login(email=self.votante.email, password=CLAVE_VOTANTE)
        respuesta = self.votar(URL_CANCION, self.opcion_a)
        self.assertRedirects(respuesta, f"{URL_CANCION}/comprobante")
        voto = Voto.objects.get()
        self.assertEqual(
            (voto.usuario, voto.edicion, voto.categoria, voto.votacion, voto.opcion),
            (self.votante, self.edicion, self.categoria, self.votacion, self.opcion_a),
        )

    def test_cp02_rechaza_segundo_voto_en_la_misma_categoria(self):
        self.client.force_login(self.votante)
        self.votar(URL_CANCION, self.opcion_a)
        # Otra opción de la misma votación
        self.votar(URL_CANCION, self.opcion_b)
        # Otro subevento de la misma categoría
        respuesta = self.votar(URL_INEDITA, self.inedita_a)
        self.assertEqual(Voto.objects.filter(usuario=self.votante, categoria=self.categoria).count(), 1)
        pagina = self.client.get(respuesta.url)
        self.assertContains(pagina, "Ya votaste en la categoría «Música»")
        self.assertNotContains(pagina, 'id="form-voto"')

    def test_cp03_permite_votar_en_otra_categoria(self):
        self.client.force_login(self.votante)
        self.votar(URL_CANCION, self.opcion_a)
        respuesta = self.votar(URL_COMPARSA, self.comparsa_a)
        self.assertRedirects(respuesta, f"{URL_COMPARSA}/comprobante")
        self.assertEqual(Voto.objects.filter(usuario=self.votante).count(), 2)

    def test_cp04_usuario_no_autenticado_debe_iniciar_sesion(self):
        respuesta = self.votar(URL_CANCION, self.opcion_a)
        self.assertEqual(respuesta.status_code, 302)
        self.assertTrue(respuesta.url.startswith("/login?next="))
        self.assertEqual(Voto.objects.count(), 0)

    def test_cp05_rechaza_votacion_y_categoria_no_habilitadas(self):
        self.client.force_login(self.votante)
        self.votacion.cerrada_manualmente = True
        self.votacion.save()
        respuesta = self.votar(URL_CANCION, self.opcion_a)
        self.assertContains(self.client.get(respuesta.url), "La votación no está abierta.")
        # Categoría desactivada: deja de existir para el público y no recibe votos
        self.piloneras.activa = False
        self.piloneras.save()
        self.assertEqual(self.votar(URL_COMPARSA, self.comparsa_a).status_code, 404)
        self.assertEqual(Voto.objects.count(), 0)

    def test_cp06_rechaza_opcion_de_otra_categoria(self):
        self.client.force_login(self.votante)
        respuesta = self.votar(URL_CANCION, self.comparsa_a)
        self.assertContains(self.client.get(respuesta.url), "La opción no pertenece a esta votación.")
        self.assertEqual(Voto.objects.count(), 0)

    def test_cp07_mis_votos_muestra_las_categorias_votadas(self):
        self.client.force_login(self.votante)
        self.votar(URL_CANCION, self.opcion_a)
        self.votar(URL_COMPARSA, self.comparsa_a)
        respuesta = self.client.get("/mis-votos")
        for texto in ("Canción favorita del público", "Canción A", "Mejor comparsa", "Comparsa A"):
            self.assertContains(respuesta, texto)
        for voto in Voto.objects.filter(usuario=self.votante):
            self.assertContains(respuesta, voto.codigo_comprobante)
        self.assertNotContains(respuesta, "Canción inédita revelación")

    def test_cp08_administrador_consulta_los_votos(self):
        self.client.force_login(self.votante)
        self.votar(URL_CANCION, self.opcion_a)
        voto = Voto.objects.get()
        self.client.force_login(self.admin)
        respuesta = self.client.get("/django-admin/votaciones/voto/")
        self.assertEqual(respuesta.status_code, 200)
        for texto in (voto.codigo_comprobante, "Música", "Canción A", self.votante.email):
            self.assertContains(respuesta, texto)
        # El votante no entra a la consulta administrativa
        self.client.force_login(self.votante)
        self.assertNotEqual(self.client.get("/django-admin/votaciones/voto/").status_code, 200)

    def test_cp09_carrera_resuelta_por_la_restriccion_unica(self):
        """Simula la carrera: la validación previa no ve el voto que otra solicitud acaba de guardar."""
        self.client.force_login(self.votante)
        self.votar(URL_CANCION, self.opcion_a)
        with mock.patch("votaciones.votacion.servicios.voto_que_bloquea", return_value=None):
            respuesta = self.votar(URL_INEDITA, self.inedita_a)
        self.assertEqual(Voto.objects.filter(usuario=self.votante).count(), 1)
        self.assertContains(self.client.get(respuesta.url), "Solo se permite un voto por categoría")

    def test_cp10_api_get_categorias_entrega_json_con_opciones(self):
        respuesta = self.client.get("/api/categorias/")
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta["Content-Type"], "application/json")
        datos = json.loads(respuesta.content)
        filas = datos["results"] if isinstance(datos, dict) else datos
        musica = next(c for c in filas if c["slug"] == "musica")
        self.assertEqual(musica["edicion_anio"], 2027)
        titulos = {v["titulo"]: [o["nombre"] for o in v["opciones"]] for v in musica["votaciones"]}
        self.assertEqual(titulos["Canción favorita del público"], ["Canción A", "Canción B"])
        self.assertEqual(titulos["Canción inédita revelación"], ["Inédita A", "Inédita B"])
        self.assertIn("piloneras", [c["slug"] for c in filas])


class VotoUnicoConfigurable(Entrega3Mixin, BasePortalTest):
    """Check «Un solo voto en toda la categoría»: desmarcado, cada votación de la categoría se vota aparte."""

    def setUp(self):
        super().setUp()
        self.crear_escenario()

    def votar(self, url, opcion):
        return self.client.post(f"{url}/votar", {"opcion": opcion.pk})

    def test_por_defecto_la_categoria_es_de_voto_unico(self):
        self.assertTrue(Categoria.objects.create(edicion=self.edicion, nombre="Nueva", descripcion="x").voto_unico)

    def test_desmarcado_permite_votar_en_cada_subevento_una_vez(self):
        self.categoria.voto_unico = False
        self.categoria.save()
        self.client.force_login(self.votante)
        self.assertRedirects(self.votar(URL_CANCION, self.opcion_a), f"{URL_CANCION}/comprobante")
        self.assertRedirects(self.votar(URL_INEDITA, self.inedita_a), f"{URL_INEDITA}/comprobante")
        respuesta = self.votar(URL_CANCION, self.opcion_b)
        self.assertContains(self.client.get(respuesta.url), "Ya votaste en esta votación")
        self.assertEqual(Voto.objects.filter(usuario=self.votante, categoria=self.categoria).count(), 2)

    def test_panel_guarda_el_check_y_lo_bloquea_con_votos(self):
        self.entrar_como_admin()
        datos = {"edicion": self.edicion.pk, "nombre": "Música", "slug": "musica", "descripcion": "Canciones",
                 "icono": "music-note-beamed", "orden": 1, "activa": "on"}  # sin «voto_unico»: desmarcado
        self.client.post(f"/panel/categorias/{self.categoria.pk}/editar", datos)
        self.categoria.refresh_from_db()
        self.assertFalse(self.categoria.voto_unico)
        Voto.objects.create(usuario=self.votante, votacion=self.votacion, opcion=self.opcion_a, codigo_comprobante="FLV27-CFG001")
        respuesta = self.client.post(f"/panel/categorias/{self.categoria.pk}/editar", {**datos, "voto_unico": "on"})
        self.assertContains(respuesta, "la categoría ya tiene votos")
        self.categoria.refresh_from_db()
        self.assertFalse(self.categoria.voto_unico)

    def test_api_expone_el_modo_de_voto(self):
        musica = next(c for c in self.client.get("/api/categorias/").json() if c["slug"] == "musica")
        self.assertTrue(musica["voto_unico"])


@skipUnless(connection.vendor == "mysql", "La concurrencia real se prueba contra MySQL (DB_ENGINE=mysql)")
@override_settings(CORREO_ADAPTADOR="memoria")
class ConcurrenciaMySQL(Entrega3Mixin, TransactionTestCase):
    """CP-09 con dos hilos que votan al mismo tiempo en dos subeventos de la misma categoría."""

    def setUp(self):
        BasePortalTest.setUp(self)
        self.crear_escenario()

    def test_cp09_dos_solicitudes_simultaneas_dejan_un_solo_voto(self):
        from django.test import Client

        barrera = threading.Barrier(2)
        estados = []

        def votar(url, opcion):
            cliente = Client()
            cliente.force_login(Usuario.objects.get(pk=self.votante.pk))
            barrera.wait()
            try:
                estados.append(cliente.post(f"{url}/votar", {"opcion": opcion.pk}).url)
            finally:
                connections.close_all()

        hilos = [
            threading.Thread(target=votar, args=(URL_CANCION, self.opcion_a)),
            threading.Thread(target=votar, args=(URL_INEDITA, self.inedita_a)),
        ]
        for hilo in hilos:
            hilo.start()
        for hilo in hilos:
            hilo.join()
        self.assertEqual(len(estados), 2)
        self.assertEqual(Voto.objects.filter(usuario=self.votante, categoria=self.categoria).count(), 1)
        self.assertEqual(sum(url.endswith("/comprobante") for url in estados), 1)
