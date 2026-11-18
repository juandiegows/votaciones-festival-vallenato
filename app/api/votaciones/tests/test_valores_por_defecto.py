"""Valores por defecto de lo que se crea (Configuración → Valores por defecto) aplicados desde la API."""

from datetime import timedelta

from django.utils import timezone

from votaciones.models import Categoria, Edicion, Votacion
from votaciones.sitio.models import ConfiguracionSitio

from .base import BaseAPITest


class ValoresPorDefectoAPITests(BaseAPITest):
    def setUp(self):
        super().setUp()
        self.autenticar(self.admin)
        ConfiguracionSitio.obtener()
        ConfiguracionSitio.objects.filter(pk=1).update(
            defecto_presentacion_categorias="lista", defecto_visibilidad_resultados="tiempo_real", defecto_voto_unico=False,
            defecto_categoria_activa=False, defecto_presentacion_opciones="duelo", defecto_dias_votacion=3,
        )

    def test_lo_que_no_se_envia_toma_el_valor_por_defecto(self):
        respuesta = self.client.post("/api/gestion/ediciones/", {
            "nombre": "Festival 2031", "anio": 2031, "fecha_inicio": "2031-04-26", "fecha_fin": "2031-04-30", "estado": "cerrada",
        }, format="json")
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        edicion = Edicion.objects.get(anio=2031)
        self.assertEqual((edicion.presentacion_categorias, edicion.visibilidad_resultados), ("lista", "tiempo_real"))
        respuesta = self.client.post("/api/gestion/categorias/", {"edicion": self.edicion.pk, "nombre": "Piloneras"}, format="json")
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        categoria = Categoria.objects.get(nombre="Piloneras")
        self.assertEqual((categoria.voto_unico, categoria.activa), (False, False))
        ahora = timezone.now()
        respuesta = self.client.post("/api/gestion/votaciones/", {
            "categoria": self.categoria.pk, "titulo": "Mejor comparsa", "fecha_apertura": ahora.isoformat(),
            "fecha_cierre": (ahora + timedelta(days=2)).isoformat(),
        }, format="json")
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertEqual(Votacion.objects.get(titulo="Mejor comparsa").presentacion_opciones, "duelo")

    def test_lo_que_se_envia_se_respeta(self):
        self.client.post("/api/gestion/categorias/", {"edicion": self.edicion.pk, "nombre": "Paseos", "activa": True}, format="json")
        self.assertTrue(Categoria.objects.get(nombre="Paseos").activa)

    def test_la_configuracion_publica_los_expone(self):
        configuracion = self.client.get("/api/sitio/").data["configuracion"]
        self.assertEqual(configuracion["defecto_presentacion_opciones"], "duelo")
        self.assertEqual(configuracion["defecto_dias_votacion"], 3)

    def test_valida_los_dias(self):
        respuesta = self.client.patch("/api/gestion/configuracion/", {"defecto_dias_votacion": 0}, format="json")
        self.assertEqual(respuesta.status_code, 400)
