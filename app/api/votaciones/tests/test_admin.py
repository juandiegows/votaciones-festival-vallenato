from datetime import timedelta

from django.utils import timezone

from votaciones.models import Categoria, Edicion, Opcion, RegistroAuditoria, Votacion, Voto

from .base import BaseAPITest


class PermisosAdminTests(BaseAPITest):
    def test_visitante_sin_acceso(self):
        self.assertEqual(self.client.get("/api/admin/votaciones/").status_code, 401)

    def test_votante_sin_acceso(self):
        self.autenticar(self.votante)
        self.assertEqual(self.client.get("/api/admin/votaciones/").status_code, 403)
        self.assertEqual(self.client.get("/api/admin/auditoria/").status_code, 403)


class GestionAdminTests(BaseAPITest):
    def setUp(self):
        super().setUp()
        self.autenticar(self.admin)

    def nueva_votacion(self, **cambios):
        ahora = timezone.now()
        datos = {
            "categoria": self.categoria.pk, "titulo": "Mejor comparsa",
            "fecha_apertura": (ahora - timedelta(hours=1)).isoformat(),
            "fecha_cierre": (ahora + timedelta(days=2)).isoformat(),
            "votos_por_usuario": 1, "visibilidad_resultados": "al_cierre",
        }
        datos.update(cambios)
        return self.client.post("/api/admin/votaciones/", datos, format="json")

    def test_crear_categoria_queda_auditada(self):
        respuesta = self.client.post("/api/admin/categorias/", {"edicion": self.edicion.pk, "nombre": "Piloneras"}, format="json")
        self.assertEqual(respuesta.status_code, 201)
        registro = RegistroAuditoria.objects.get(accion="crear", entidad="categoria")
        self.assertEqual(registro.usuario, self.admin)

    def test_categoria_duplicada_en_misma_edicion(self):
        respuesta = self.client.post("/api/admin/categorias/", {"edicion": self.edicion.pk, "nombre": "Música"}, format="json")
        self.assertEqual(respuesta.status_code, 400)

    def test_crear_votacion_inicia_como_borrador(self):
        respuesta = self.nueva_votacion(publicada=True)
        self.assertEqual(respuesta.status_code, 201)
        self.assertEqual(respuesta.data["estado"], "borrador")
        self.assertFalse(respuesta.data["publicada"])

    def test_votacion_con_fechas_invalidas(self):
        ahora = timezone.now()
        respuesta = self.nueva_votacion(fecha_apertura=ahora.isoformat(), fecha_cierre=(ahora - timedelta(days=1)).isoformat())
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("fecha_cierre", respuesta.data)

    def test_publicar_exige_dos_opciones(self):
        votacion_id = self.nueva_votacion().data["id"]
        Opcion.objects.create(votacion_id=votacion_id, nombre="Única")
        respuesta = self.client.post(f"/api/admin/votaciones/{votacion_id}/publicar/")
        self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(respuesta.data["codigo"], "opciones_insuficientes")
        Opcion.objects.create(votacion_id=votacion_id, nombre="Segunda")
        respuesta = self.client.post(f"/api/admin/votaciones/{votacion_id}/publicar/")
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data["estado"], "abierta")

    def test_no_elimina_votacion_con_votos(self):
        Voto.objects.create(usuario=self.votante, votacion=self.abierta, opcion=self.opcion_a, codigo_comprobante="FLV27-CCCCCC")
        respuesta = self.client.delete(f"/api/admin/votaciones/{self.abierta.pk}/")
        self.assertEqual(respuesta.status_code, 409)
        self.assertEqual(respuesta.data["codigo"], "tiene_votos")
        self.assertTrue(Votacion.objects.filter(pk=self.abierta.pk).exists())

    def test_votacion_cerrada_no_admite_opciones_nuevas(self):
        ahora = timezone.now()
        cerrada = self.crear_votacion("Votación cerrada", ahora - timedelta(days=5), ahora - timedelta(days=1))
        respuesta = self.client.post("/api/admin/opciones/", {"votacion": cerrada.pk, "nombre": "Tardía"}, format="json")
        self.assertEqual(respuesta.status_code, 400)
        self.assertFalse(Opcion.objects.filter(votacion=cerrada, nombre="Tardía").exists())
        opcion = Opcion.objects.create(votacion=cerrada, nombre="Existente")
        self.assertEqual(self.client.patch(f"/api/admin/opciones/{opcion.pk}/", {"nombre": "Corregida"}, format="json").status_code, 200)

    def test_edicion_cerrada_no_admite_categorias_nuevas(self):
        cerrada = Edicion.objects.create(nombre="Festival 2025", anio=2025, fecha_inicio="2025-04-26", fecha_fin="2025-04-30", estado="cerrada")
        respuesta = self.client.post("/api/admin/categorias/", {"edicion": cerrada.pk, "nombre": "Piloneras"}, format="json")
        self.assertEqual(respuesta.status_code, 400)
        movida = self.client.patch(f"/api/admin/categorias/{self.categoria.pk}/", {"edicion": cerrada.pk}, format="json")
        self.assertEqual(movida.status_code, 400)
        vieja = Categoria.objects.create(edicion=cerrada, nombre="Vestuario")
        self.assertEqual(self.client.patch(f"/api/admin/categorias/{vieja.pk}/", {"nombre": "Vestuario típico"}, format="json").status_code, 200)

    def test_no_elimina_opcion_con_votos(self):
        Voto.objects.create(usuario=self.votante, votacion=self.abierta, opcion=self.opcion_a, codigo_comprobante="FLV27-DDDDDD")
        self.assertEqual(self.client.delete(f"/api/admin/opciones/{self.opcion_a.pk}/").status_code, 409)

    def test_elimina_votacion_sin_votos(self):
        votacion_id = self.nueva_votacion().data["id"]
        self.assertEqual(self.client.delete(f"/api/admin/votaciones/{votacion_id}/").status_code, 204)
        self.assertTrue(RegistroAuditoria.objects.filter(accion="eliminar", entidad="votacion").exists())

    def test_no_elimina_categoria_con_votaciones(self):
        respuesta = self.client.delete(f"/api/admin/categorias/{self.categoria.pk}/")
        self.assertEqual(respuesta.status_code, 409)

    def test_cerrar_votacion(self):
        respuesta = self.client.post(f"/api/admin/votaciones/{self.abierta.pk}/cerrar/")
        self.assertEqual(respuesta.data["estado"], "cerrada")

    def test_resultados_admin_siempre_visibles(self):
        Voto.objects.create(usuario=self.votante, votacion=self.abierta, opcion=self.opcion_b, codigo_comprobante="FLV27-EEEEEE")
        datos = self.client.get(f"/api/admin/votaciones/{self.abierta.pk}/resultados/").data
        self.assertEqual(datos["total_votos"], 1)
        self.assertEqual(datos["resultados"][0]["opcion"], "Canción B")
        self.assertEqual(self.client.get(f"/api/votaciones/{self.abierta.pk}/resultados/").status_code, 200)

    def test_exportar_csv(self):
        Voto.objects.create(usuario=self.votante, votacion=self.abierta, opcion=self.opcion_a, codigo_comprobante="FLV27-FFFFFF")
        respuesta = self.client.get(f"/api/admin/votaciones/{self.abierta.pk}/resultados/csv/")
        self.assertEqual(respuesta.status_code, 200)
        self.assertIn("text/csv", respuesta["Content-Type"])
        contenido = respuesta.content.decode("utf-8-sig")
        self.assertIn("Canción A,1,100.0", contenido)

    def test_publicar_resultados(self):
        respuesta = self.client.post(f"/api/admin/votaciones/{self.abierta.pk}/publicar-resultados/", {"publicar": True}, format="json")
        self.assertTrue(respuesta.data["resultados_publicados"])
        self.salir()
        self.assertEqual(self.client.get(f"/api/votaciones/{self.abierta.pk}/resultados/").status_code, 200)

    def test_auditoria_paginada(self):
        self.client.post(f"/api/admin/votaciones/{self.abierta.pk}/cerrar/")
        datos = self.client.get("/api/admin/auditoria/").data
        self.assertEqual(datos["count"], 1)
        self.assertEqual(datos["results"][0]["accion"], "cerrar")
