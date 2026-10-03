"""Endpoints y comandos que necesita la web React en modo API."""
from datetime import date, timedelta
from io import StringIO

from unittest import mock

from django.core.management import CommandError, call_command
from django.test import override_settings
from django.utils import timezone

from votaciones.models import Categoria, Edicion, Opcion, RegistroAuditoria, Usuario, Votacion, Voto

from .base import BaseAPITest


class OpcionesPublicasTests(BaseAPITest):
    def test_lista_opciones_activas_de_votaciones_publicadas(self):
        ahora = timezone.now()
        borrador = self.crear_votacion("Borrador", ahora, ahora + timedelta(days=1), publicada=False)
        Opcion.objects.create(votacion=borrador, nombre="Oculta por borrador")
        Opcion.objects.create(votacion=self.abierta, nombre="Inactiva", activa=False)
        datos = self.client.get("/api/opciones/").data
        self.assertEqual([o["nombre"] for o in datos], ["Canción A", "Canción B"])
        self.assertEqual(datos[0]["votacion"], self.abierta.pk)

    def test_filtro_por_votacion(self):
        ahora = timezone.now()
        otra = self.crear_votacion("Otra", ahora, ahora + timedelta(days=1))
        Opcion.objects.create(votacion=otra, nombre="Opción de otra")
        datos = self.client.get("/api/opciones/", {"votacion": otra.pk}).data
        self.assertEqual([o["nombre"] for o in datos], ["Opción de otra"])

    def test_excluye_categorias_inactivas(self):
        self.categoria.activa = False
        self.categoria.save()
        self.assertEqual(self.client.get("/api/opciones/").data, [])

    def test_solo_lectura(self):
        respuesta = self.client.post("/api/opciones/", {"votacion": self.abierta.pk, "nombre": "X"})
        self.assertIn(respuesta.status_code, (401, 405))


class VotosYUsuariosAdminTests(BaseAPITest):
    def setUp(self):
        super().setUp()
        Voto.objects.create(usuario=self.votante, votacion=self.abierta, opcion=self.opcion_a, codigo_comprobante="FLV27-GGGGGG")

    def test_votante_sin_acceso(self):
        self.autenticar(self.votante)
        self.assertEqual(self.client.get("/api/admin/votos/").status_code, 403)
        self.assertEqual(self.client.get("/api/admin/usuarios/").status_code, 403)

    def test_votos_sin_datos_del_votante(self):
        self.autenticar(self.admin)
        datos = self.client.get("/api/admin/votos/").data
        self.assertEqual(len(datos), 1)
        self.assertEqual(set(datos[0]), {"id", "votacion", "opcion", "fecha_hora"})
        self.assertEqual(datos[0]["opcion"], self.opcion_a.pk)

    def test_votos_filtro_por_votacion(self):
        self.autenticar(self.admin)
        self.assertEqual(len(self.client.get("/api/admin/votos/", {"votacion": self.abierta.pk + 99}).data), 0)
        self.assertEqual(len(self.client.get("/api/admin/votos/", {"votacion": self.abierta.pk}).data), 1)

    def test_usuarios_sin_contrasena_y_filtro_por_rol(self):
        self.autenticar(self.admin)
        datos = self.client.get("/api/admin/usuarios/").data
        self.assertEqual(len(datos), 2)
        self.assertNotIn("password", datos[0])
        votantes = self.client.get("/api/admin/usuarios/", {"rol": "votante"}).data
        self.assertEqual([u["email"] for u in votantes], ["votante@festival.test"])


class EdicionActivaUnicaTests(BaseAPITest):
    def test_activar_nueva_edicion_cierra_las_demas(self):
        self.autenticar(self.admin)
        respuesta = self.client.post("/api/admin/ediciones/", {
            "nombre": "Festival de la Leyenda Vallenata 2028", "anio": 2028,
            "fecha_inicio": "2028-04-26", "fecha_fin": "2028-04-30", "estado": "activa",
        }, format="json")
        self.assertEqual(respuesta.status_code, 201)
        self.edicion.refresh_from_db()
        self.assertEqual(self.edicion.estado, "cerrada")
        self.assertEqual(self.client.get("/api/ediciones/vigente/").data["anio"], 2028)

    def test_comprobante_usa_anio_de_la_edicion(self):
        edicion = Edicion.objects.create(nombre="Edición 2028", anio=2028, fecha_inicio=date(2028, 4, 26), fecha_fin=date(2028, 4, 30))
        categoria = Categoria.objects.create(edicion=edicion, nombre="Música 2028")
        ahora = timezone.now()
        votacion = Votacion.objects.create(categoria=categoria, titulo="Canción 2028", fecha_apertura=ahora - timedelta(hours=1),
                                           fecha_cierre=ahora + timedelta(days=1), publicada=True)
        opcion = Opcion.objects.create(votacion=votacion, nombre="A")
        Opcion.objects.create(votacion=votacion, nombre="B")
        self.autenticar(self.votante)
        respuesta = self.client.post(f"/api/votaciones/{votacion.pk}/votar/", {"opcion": opcion.pk}, format="json")
        self.assertEqual(respuesta.status_code, 201)
        self.assertTrue(respuesta.data["codigo_comprobante"].startswith("FLV28-"))


# Las claves documentadas solo se aceptan con DEBUG (desarrollo local)
@override_settings(DEBUG=True)
class CargarDemoTests(BaseAPITest):
    def setUp(self):
        # Base de datos vacía: el comando crea sus propios datos.
        pass

    def cargar(self, *args):
        salida = StringIO()
        call_command("cargar_demo", *args, stdout=salida)
        return salida.getvalue()

    @override_settings(DEBUG=False)
    def test_sin_debug_exige_claves_propias(self):
        with mock.patch.dict("os.environ", {}, clear=False) as entorno:
            entorno.pop("DEMO_CLAVE_ADMIN", None)
            entorno.pop("DEMO_CLAVE_VOTANTE", None)
            with self.assertRaises(CommandError):
                self.cargar()
        self.assertFalse(Edicion.objects.exists())

    @override_settings(DEBUG=False)
    def test_sin_debug_usa_las_claves_del_entorno(self):
        with mock.patch.dict("os.environ", {"DEMO_CLAVE_ADMIN": "Otra*Clave2027", "DEMO_CLAVE_VOTANTE": "Otra*Voto2027"}):
            self.cargar()
        admin = Usuario.objects.get(email="admin@festival.test")
        self.assertTrue(admin.check_password("Otra*Clave2027"))
        self.assertFalse(admin.check_password("Admin2027*"))

    def test_carga_datos_equivalentes_al_seed(self):
        self.assertIn("cargados", self.cargar())
        self.assertEqual(Edicion.objects.get(estado="activa").anio, 2027)
        self.assertEqual(Edicion.objects.get(anio=2026).estado, "cerrada")
        self.assertEqual(Categoria.objects.filter(edicion__anio=2027).count(), 5)
        self.assertEqual(Votacion.objects.filter(categoria__edicion__anio=2027).count(), 8)
        estados = {v.estado for v in Votacion.objects.all()}
        self.assertTrue({"abierta", "programada", "cerrada", "borrador"} <= estados)
        borrador = Votacion.objects.get(publicada=False)
        self.assertEqual(borrador.opciones.count(), 1)
        self.assertGreaterEqual(Usuario.objects.filter(email__endswith="@demo.festival.test").count(), 100)
        self.assertGreater(Voto.objects.count(), 300)
        self.assertTrue(Voto.objects.filter(codigo_comprobante="FLV27-8F3K2A").exists())
        self.assertEqual(RegistroAuditoria.objects.count(), 5)

    def test_credenciales_demo(self):
        self.cargar()
        admin = Usuario.objects.get(email="admin@festival.test")
        self.assertTrue(admin.es_administrador and admin.is_staff)
        respuesta = self.client.post("/api/auth/login/", {"email": "admin@festival.test", "password": "Admin2027*"}, format="json")
        self.assertEqual(respuesta.status_code, 200)
        respuesta = self.client.post("/api/auth/login/", {"email": "votante@festival.test", "password": "Voto2027*"}, format="json")
        self.assertEqual(respuesta.data["usuario"]["rol"], "votante")

    def test_idempotente(self):
        self.cargar()
        total = Voto.objects.count()
        self.assertIn("ya están cargados", self.cargar())
        self.assertEqual(Votacion.objects.count(), 13)
        self.assertEqual(Voto.objects.count(), total)

    def test_reiniciar_borra_cambios_y_recarga(self):
        self.cargar()
        Categoria.objects.create(edicion=Edicion.objects.get(anio=2027), nombre="Creada por el administrador")
        externo = Usuario.objects.create_user("externo@correo.test", "Clave-Segura-2027", nombres="Ext", apellidos="Erno")
        votacion = next(v for v in Votacion.objects.all() if v.estado == "abierta")
        Voto.objects.create(usuario=externo, votacion=votacion, opcion=votacion.opciones.first(), codigo_comprobante="FLV27-ZZZZZZ")
        self.cargar("--reiniciar")
        self.assertEqual(Categoria.objects.count(), 9)
        self.assertFalse(Voto.objects.filter(codigo_comprobante="FLV27-ZZZZZZ").exists())
        self.assertTrue(Usuario.objects.filter(email="externo@correo.test").exists())
        self.assertEqual(Usuario.objects.filter(email="admin@festival.test").count(), 1)


class SlugsTests(BaseAPITest):
    def test_slug_automatico_sin_tildes_y_unico(self):
        self.assertEqual(self.categoria.slug, "musica")
        self.assertEqual(self.abierta.slug, "cancion-favorita-del-publico")
        ahora = timezone.now()
        repetida = self.crear_votacion("Canción favorita del público", ahora, ahora + timedelta(days=1))
        self.assertEqual(repetida.slug, "cancion-favorita-del-publico-2")
        otra_edicion = Edicion.objects.create(nombre="Edición 2028", anio=2028, fecha_inicio=date(2028, 4, 26), fecha_fin=date(2028, 4, 30))
        self.assertEqual(Categoria.objects.create(edicion=otra_edicion, nombre="Música").slug, "musica")

    def test_admin_puede_editar_slug_con_formato_valido(self):
        self.autenticar(self.admin)
        url = f"/api/admin/categorias/{self.categoria.pk}/"
        self.assertEqual(self.client.patch(url, {"slug": "Música Vallenata"}, format="json").status_code, 400)
        respuesta = self.client.patch(url, {"slug": "musica-vallenata"}, format="json")
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data["slug"], "musica-vallenata")

    def test_slug_duplicado_en_la_misma_categoria(self):
        self.autenticar(self.admin)
        ahora = timezone.now()
        respuesta = self.client.post("/api/admin/votaciones/", {
            "categoria": self.categoria.pk, "titulo": "Otra", "slug": "cancion-favorita-del-publico",
            "fecha_apertura": ahora.isoformat(), "fecha_cierre": (ahora + timedelta(days=1)).isoformat(),
        }, format="json")
        self.assertEqual(respuesta.status_code, 400)

    def test_crear_sin_slug_lo_genera(self):
        self.autenticar(self.admin)
        respuesta = self.client.post("/api/admin/categorias/", {"edicion": self.edicion.pk, "nombre": "Reconocimientos del público"}, format="json")
        self.assertEqual(respuesta.status_code, 201)
        self.assertEqual(respuesta.data["slug"], "reconocimientos-del-publico")
        self.assertEqual(respuesta.data["edicion_anio"], 2027)


class RutasAmigablesTests(BaseAPITest):
    def test_por_ruta(self):
        respuesta = self.client.get("/api/votaciones/por-ruta/", {"anio": 2027, "categoria": "musica", "votacion": "cancion-favorita-del-publico"})
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data["id"], self.abierta.pk)
        self.assertEqual(len(respuesta.data["opciones"]), 2)
        self.assertEqual(respuesta.data["edicion_anio"], 2027)

    def test_por_ruta_inexistente_o_borrador(self):
        self.assertEqual(self.client.get("/api/votaciones/por-ruta/", {"anio": 2026, "categoria": "musica", "votacion": "cancion-favorita-del-publico"}).status_code, 404)
        self.assertEqual(self.client.get("/api/votaciones/por-ruta/", {"anio": "x", "categoria": "musica", "votacion": "y"}).status_code, 404)
        ahora = timezone.now()
        self.crear_votacion("Borrador", ahora, ahora + timedelta(days=1), publicada=False)
        self.assertEqual(self.client.get("/api/votaciones/por-ruta/", {"anio": 2027, "categoria": "musica", "votacion": "borrador"}).status_code, 404)

    def test_filtros_por_anio_y_slug(self):
        datos = self.client.get("/api/votaciones/", {"anio": 2027, "categoria_slug": "musica"}).data
        self.assertEqual([v["slug"] for v in datos], ["cancion-favorita-del-publico"])
        self.assertEqual(self.client.get("/api/votaciones/", {"anio": 2026}).data, [])
        self.assertEqual([c["slug"] for c in self.client.get("/api/categorias/", {"anio": 2027}).data], ["musica"])

    def test_mis_votos_incluye_ruta(self):
        Voto.objects.create(usuario=self.votante, votacion=self.abierta, opcion=self.opcion_a, codigo_comprobante="FLV27-HHHHHH")
        self.autenticar(self.votante)
        voto = self.client.get("/api/mis-votos/").data[0]
        self.assertEqual((voto["edicion_anio"], voto["categoria_slug"], voto["votacion_slug"]), (2027, "musica", "cancion-favorita-del-publico"))


class EnlaceMultimediaTests(BaseAPITest):
    def setUp(self):
        super().setUp()
        self.autenticar(self.admin)

    def guardar(self, enlace):
        return self.client.patch(f"/api/admin/opciones/{self.opcion_a.pk}/", {"enlace_multimedia": enlace}, format="json")

    def test_acepta_url_absoluta_y_ruta_relativa(self):
        self.assertEqual(self.guardar("https://www.youtube.com/watch?v=abc123").status_code, 200)
        respuesta = self.guardar("/audio/muestras/brisas-del-guatapuri.mp3")
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.data["enlace_multimedia"], "/audio/muestras/brisas-del-guatapuri.mp3")
        self.assertEqual(self.guardar("").status_code, 200)

    def test_rechaza_enlaces_invalidos(self):
        for enlace in ["javascript:alert(1)", "audio/x.mp3", "//otro.sitio/x.mp3", "ftp://x.test/a.mp3"]:
            self.assertEqual(self.guardar(enlace).status_code, 400, enlace)


@override_settings(DEBUG=True)
class CargarDemoRutasTests(BaseAPITest):
    def setUp(self):
        pass

    def test_slugs_y_muestras_de_audio(self):
        call_command("cargar_demo", stdout=StringIO())
        votacion = Votacion.objects.get(slug="cancion-favorita-del-publico", categoria__edicion__anio=2027)
        self.assertEqual(votacion.categoria.slug, "musica")
        enlaces = list(votacion.opciones.order_by("orden").values_list("enlace_multimedia", flat=True))
        self.assertEqual(enlaces[0], "/audio/muestras/brisas-del-guatapuri.mp3")
        self.assertEqual(len([e for e in enlaces if e.endswith(".mp3")]), 5)
        ineditas = Votacion.objects.get(slug="cancion-inedita-revelacion", categoria__edicion__anio=2027).opciones.exclude(enlace_multimedia="").count()
        self.assertEqual(ineditas, 4)
        self.assertFalse(Opcion.objects.filter(votacion__categoria__slug="piloneras").exclude(enlace_multimedia="").exists())
        respuesta = self.client.get("/api/votaciones/por-ruta/", {"anio": 2027, "categoria": "musica", "votacion": "cancion-favorita-del-publico"})
        self.assertEqual(respuesta.status_code, 200)


class RegistroMensajesTests(BaseAPITest):
    def test_correo_duplicado_con_mensaje_claro(self):
        respuesta = self.client.post("/api/auth/registro/", {
            "email": "votante@festival.test", "nombres": "Otra", "apellidos": "Persona",
            "password": "Clave-Segura-2027", "acepta_tratamiento_datos": True,
        }, format="json")
        self.assertEqual(respuesta.status_code, 400)
        self.assertEqual(respuesta.data["email"], ["Ya existe una cuenta con este correo."])
