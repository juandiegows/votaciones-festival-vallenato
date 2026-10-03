from datetime import timedelta

from django.utils import timezone

from votaciones.models import Categoria, ConfiguracionSitio, Edicion, Usuario

from .base import BaseAPITest


class ColumnasSoporteTest(BaseAPITest):
    """El interceptor (UsuarioActualMiddleware + ModeloTrazable) llena creado_por / actualizado_por solo."""

    def setUp(self):
        super().setUp()
        self.otro_admin = Usuario.objects.create_user(
            "otro@festival.test", "Otro2027*seguro", nombres="Beto", apellidos="Gestor",
            rol=Usuario.Rol.ADMINISTRADOR, acepta_tratamiento_datos=True, correo_verificado=True,
        )

    def test_crear_desde_la_api_registra_quien_crea(self):
        self.autenticar(self.admin)
        respuesta = self.client.post(
            "/api/gestion/categorias/", {"edicion": self.edicion.pk, "nombre": "Pintura"}, format="json"
        )
        self.assertEqual(respuesta.status_code, 201)
        categoria = Categoria.objects.get(pk=respuesta.data["id"])
        self.assertEqual(categoria.creado_por, self.admin)
        self.assertEqual(categoria.actualizado_por, self.admin)
        self.assertIsNotNone(categoria.creado_en)

    def test_editar_conserva_el_creador_y_cambia_quien_actualiza(self):
        self.autenticar(self.admin)
        pk = self.client.post(
            "/api/gestion/categorias/", {"edicion": self.edicion.pk, "nombre": "Pintura"}, format="json"
        ).data["id"]
        self.autenticar(self.otro_admin)
        self.client.patch(f"/api/gestion/categorias/{pk}/", {"nombre": "Pintura naíf"}, format="json")
        categoria = Categoria.objects.get(pk=pk)
        self.assertEqual(categoria.creado_por, self.admin)
        self.assertEqual(categoria.actualizado_por, self.otro_admin)
        self.assertGreaterEqual(categoria.actualizado_en, categoria.creado_en)

    def test_acciones_con_update_fields_marcan_quien_actualiza(self):
        borrador = self.crear_votacion(
            "Borrador", timezone.now() + timedelta(days=1), timezone.now() + timedelta(days=3), publicada=False
        )
        borrador.opciones.create(nombre="A")
        borrador.opciones.create(nombre="B")
        self.autenticar(self.otro_admin)
        self.assertEqual(self.client.post(f"/api/gestion/votaciones/{borrador.pk}/publicar/").status_code, 200)
        borrador.refresh_from_db()
        self.assertTrue(borrador.publicada)
        self.assertEqual(borrador.actualizado_por, self.otro_admin)

    def test_update_masivo_marca_quien_actualiza(self):
        self.autenticar(self.otro_admin)
        url = f"/api/gestion/ediciones/{self.edicion.pk}/publicar-resultados/"
        self.assertEqual(self.client.post(url, {"publicar": True}, format="json").status_code, 200)
        self.abierta.refresh_from_db()
        self.assertTrue(self.abierta.resultados_publicados)
        self.assertEqual(self.abierta.actualizado_por, self.otro_admin)

    def test_configuracion_del_sitio(self):
        self.autenticar(self.admin)
        self.client.patch("/api/gestion/configuracion/", {"telefono": "300 000 0000"}, format="json")
        self.assertEqual(ConfiguracionSitio.obtener().actualizado_por, self.admin)

    def test_fuera_de_un_request_quedan_vacios(self):
        edicion = Edicion.objects.create(
            nombre="Edición sin request", anio=2030, fecha_inicio=self.edicion.fecha_inicio,
            fecha_fin=self.edicion.fecha_fin, estado=Edicion.Estado.CERRADA,
        )
        self.assertIsNone(edicion.creado_por)
        self.assertIsNone(edicion.actualizado_por)

    def test_la_api_publica_no_expone_autores(self):
        self.autenticar(self.admin)
        self.client.patch(f"/api/gestion/votaciones/{self.abierta.pk}/", {"descripcion": "x"}, format="json")
        self.salir()
        detalle = self.client.get(f"/api/votaciones/{self.abierta.pk}/").json()
        self.assertNotIn("actualizado_por", detalle)
        self.assertNotIn("creado_por", detalle)
        # El contrato de gestión conserva sus nombres
        self.autenticar(self.admin)
        gestion = self.client.get(f"/api/gestion/votaciones/{self.abierta.pk}/").json()
        self.assertIn("creada_en", gestion)
        self.assertIn("actualizada_en", gestion)


class AutoriaEndpointTest(BaseAPITest):
    URL = "/api/gestion/auditoria/autoria/"

    def test_solo_administradores(self):
        self.assertEqual(self.client.get(self.URL).status_code, 401)
        self.autenticar(self.votante)
        self.assertEqual(self.client.get(self.URL).status_code, 403)

    def test_lista_quien_creo_y_modifico_cada_registro(self):
        self.autenticar(self.admin)
        self.client.patch(f"/api/gestion/votaciones/{self.abierta.pk}/", {"descripcion": "Nueva"}, format="json")
        datos = self.client.get(f"{self.URL}?edicion={self.edicion.pk}").json()
        self.assertEqual(datos["edicion_id"], self.edicion.pk)
        votacion = next(r for r in datos["registros"] if r["entidad"] == "votacion" and r["entidad_id"] == self.abierta.pk)
        self.assertEqual(votacion["nombre"], self.abierta.titulo)
        self.assertIsNone(votacion["creado_por"])  # la creó el setUp, fuera de un request
        self.assertIn("admin@festival.test", votacion["actualizado_por"])
        # Lo más reciente primero
        self.assertEqual(datos["registros"][0]["entidad_id"], self.abierta.pk)
        entidades = {r["entidad"] for r in datos["registros"]}
        self.assertTrue({"edicion", "categoria", "votacion", "opcion"} <= entidades)

    def test_sin_edicion(self):
        self.autenticar(self.admin)
        self.assertEqual(self.client.get(f"{self.URL}?edicion=9999").status_code, 404)
        Edicion.objects.update(estado=Edicion.Estado.CERRADA)
        respuesta = self.client.get(self.URL)
        self.assertEqual(respuesta.status_code, 404)
        self.assertEqual(respuesta.json()["detail"], "No hay una edición activa.")
