"""Despublicar, participación (quién votó, sin revelar por qué), resumen por edición, integridad, archivos y auditoría."""
import io
from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from PIL import Image

from votaciones.models import Opcion, RegistroAuditoria, Usuario, Votacion, Voto

from .base import BaseAPITest


def png(nombre="icono.png", tamano=(16, 16)):
    datos = io.BytesIO()
    Image.new("RGB", tamano, (221, 51, 51)).save(datos, "PNG")
    return SimpleUploadedFile(nombre, datos.getvalue(), content_type="image/png")


class ConVotantesMixin:
    def crear_votantes(self, n, prefijo="v"):
        return [
            Usuario.objects.create_user(
                f"{prefijo}{i}@festival.test", "Clave2027*segura", nombres=f"Nombre{i:02d}", apellidos=f"Apellido{(n - i):02d}",
                acepta_tratamiento_datos=True,
            )
            for i in range(n)
        ]

    def votar(self, votacion, usuarios, opcion, inicio=None):
        inicio = inicio or votacion.fecha_apertura + timedelta(minutes=1)
        for i, usuario in enumerate(usuarios):
            voto = Voto.objects.create(usuario=usuario, votacion=votacion, opcion=opcion,
                                       codigo_comprobante=f"T{votacion.pk}-{usuario.pk}")
            Voto.objects.filter(pk=voto.pk).update(fecha_hora=inicio + timedelta(minutes=i))


class DespublicarTests(BaseAPITest):
    def setUp(self):
        super().setUp()
        self.autenticar(self.admin)

    def test_no_se_despublica_una_votacion_abierta(self):
        respuesta = self.client.post(f"/api/admin/votaciones/{self.abierta.pk}/despublicar/")
        self.assertEqual(respuesta.status_code, 409)
        self.assertEqual(respuesta.data["codigo"], "votacion_abierta")
        self.abierta.refresh_from_db()
        self.assertTrue(self.abierta.publicada)

    def test_despublica_una_programada_y_queda_auditada(self):
        ahora = timezone.now()
        programada = self.crear_votacion("Votación programada", ahora + timedelta(days=2), ahora + timedelta(days=4))
        respuesta = self.client.post(f"/api/admin/votaciones/{programada.pk}/despublicar/")
        self.assertEqual(respuesta.status_code, 200)
        self.assertFalse(respuesta.data["publicada"])
        self.assertTrue(RegistroAuditoria.objects.filter(accion="despublicar", entidad_id=str(programada.pk)).exists())

    def test_solo_administrador(self):
        self.autenticar(self.votante)
        self.assertEqual(self.client.post(f"/api/admin/votaciones/{self.abierta.pk}/despublicar/").status_code, 403)
        self.assertEqual(self.client.get(f"/api/admin/votaciones/{self.abierta.pk}/participacion/").status_code, 403)
        self.assertEqual(self.client.get("/api/admin/auditoria/integridad/").status_code, 403)


class ParticipacionTests(ConVotantesMixin, BaseAPITest):
    def setUp(self):
        super().setUp()
        self.autenticar(self.admin)

    def consultar(self, votacion=None):
        return self.client.get(f"/api/admin/votaciones/{(votacion or self.abierta).pk}/participacion/").data

    def test_menos_de_10_votantes_la_lista_queda_oculta(self):
        self.votar(self.abierta, self.crear_votantes(9), self.opcion_a)
        datos = self.consultar()
        self.assertFalse(datos["disponible"])
        self.assertEqual(datos["votantes"], [])
        self.assertEqual(datos["ocultos"], 9)
        self.assertEqual(datos["total_votantes"], 9)
        self.assertIn("10 votantes", datos["motivo"])

    def test_abierta_revela_en_bloques_de_10_ordenados_alfabeticamente(self):
        votantes = self.crear_votantes(23)
        self.votar(self.abierta, votantes, self.opcion_a)
        datos = self.consultar()
        self.assertTrue(datos["disponible"])
        self.assertEqual(len(datos["votantes"]), 20)
        self.assertEqual(datos["ocultos"], 3)
        # Se revelan los 20 primeros en votar, pero ordenados por apellido (no por hora)
        self.assertEqual({v["usuario_id"] for v in datos["votantes"]}, {u.pk for u in votantes[:20]})
        apellidos = [v["apellidos"] for v in datos["votantes"]]
        self.assertEqual(apellidos, sorted(apellidos))
        fila = datos["votantes"][0]
        self.assertEqual(set(fila), {"usuario_id", "nombres", "apellidos", "email", "fecha"})
        self.assertRegex(str(fila["fecha"]), r"^\d{4}-\d{2}-\d{2}$")

    def test_cerrada_muestra_todos_sin_la_opcion(self):
        ahora = timezone.now()
        cerrada = self.crear_votacion("Votación cerrada", ahora - timedelta(days=5), ahora - timedelta(days=1))
        opcion = Opcion.objects.create(votacion=cerrada, nombre="Opción", orden=1)
        self.votar(cerrada, self.crear_votantes(3), opcion)
        datos = self.consultar(cerrada)
        self.assertTrue(datos["disponible"])
        self.assertEqual(len(datos["votantes"]), 3)
        self.assertEqual(datos["ocultos"], 0)
        self.assertNotIn("opcion", str(datos["votantes"]))


class ResumenTests(ConVotantesMixin, BaseAPITest):
    def test_totales_por_categoria_votacion_y_opcion(self):
        votantes = self.crear_votantes(4)
        self.votar(self.abierta, votantes[:3], self.opcion_a)
        self.votar(self.abierta, votantes[3:], self.opcion_b)
        self.autenticar(self.admin)
        datos = self.client.get(f"/api/admin/ediciones/{self.edicion.pk}/resumen/").data
        self.assertEqual(datos["total_votos"], 4)
        categoria = datos["categorias"][0]
        self.assertEqual((categoria["nombre"], categoria["total_votos"]), ("Música", 4))
        votacion = categoria["votaciones"][0]
        self.assertEqual(votacion["total_votos"], 4)
        self.assertEqual([(o["nombre"], o["votos"]) for o in votacion["opciones"]], [("Canción A", 3), ("Canción B", 1)])
        self.assertEqual(votacion["opciones"][0]["porcentaje"], 75.0)


class IntegridadTests(ConVotantesMixin, BaseAPITest):
    def setUp(self):
        super().setUp()
        self.autenticar(self.admin)

    def fila(self, datos, votacion):
        return next(v for v in datos["votaciones"] if v["votacion_id"] == votacion.pk)

    def test_todo_cuadra(self):
        self.votar(self.abierta, self.crear_votantes(5), self.opcion_a)
        datos = self.client.get("/api/admin/auditoria/integridad/").data
        self.assertTrue(datos["ok"])
        fila = self.fila(datos, self.abierta)
        self.assertEqual((fila["total_votos"], fila["suma_por_opcion"], fila["votantes_unicos"]), (5, 5, 5))
        self.assertEqual(fila["alertas"], [])
        self.assertEqual(datos["resumen"]["votaciones_con_alertas"], 0)

    def test_detecta_voto_repetido_y_opcion_ajena(self):
        votantes = self.crear_votantes(2)
        self.votar(self.abierta, votantes, self.opcion_a)
        # Se fuerzan inconsistencias directamente en la base de datos (la API nunca las permitiría)
        Voto.objects.create(usuario=votantes[0], votacion=self.abierta, opcion=self.opcion_b, codigo_comprobante="DUP-1")
        ahora = timezone.now()
        otra = self.crear_votacion("Otra votación", ahora - timedelta(days=1), ahora + timedelta(days=1))
        Voto.objects.create(usuario=votantes[1], votacion=otra, opcion=self.opcion_a, codigo_comprobante="AJENA-1")
        datos = self.client.get("/api/admin/auditoria/integridad/", {"edicion": self.edicion.pk}).data
        self.assertFalse(datos["ok"])
        fila = self.fila(datos, self.abierta)
        self.assertEqual(fila["usuarios_excedidos"], 1)
        self.assertEqual(fila["total_votos"], 3)
        self.assertEqual(fila["suma_por_opcion"], 4)  # incluye el voto de «otra» que apunta a una opción de esta
        self.assertFalse(fila["ok"])
        self.assertTrue(any("límite" in a for a in fila["alertas"]))
        self.assertEqual(self.fila(datos, otra)["votos_opcion_ajena"], 1)
        self.assertEqual(datos["resumen"]["votaciones_con_alertas"], 2)

    def test_edicion_inexistente(self):
        self.assertEqual(self.client.get("/api/admin/auditoria/integridad/", {"edicion": 999}).status_code, 404)


class ArchivosTests(BaseAPITest):
    def setUp(self):
        super().setUp()
        self.autenticar(self.admin)

    def test_icono_de_categoria_se_sube_valida_y_se_quita(self):
        url = f"/api/admin/categorias/{self.categoria.pk}/"
        respuesta = self.client.patch(url, {"icono_imagen": png()}, format="multipart")
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertRegex(respuesta.data["icono_imagen"], r"^/media/iconos/icono.*\.png$")
        self.categoria.refresh_from_db()
        archivo = self.categoria.icono_imagen
        self.assertTrue(archivo.storage.exists(archivo.name))
        texto = SimpleUploadedFile("icono.png", b"no es imagen", content_type="image/png")
        self.assertEqual(self.client.patch(url, {"icono_imagen": texto}, format="multipart").status_code, 400)
        respuesta = self.client.patch(url, {"icono_imagen": None}, format="json")
        self.assertIsNone(respuesta.data["icono_imagen"])
        self.assertFalse(archivo.storage.exists(archivo.name))

    def test_presentaciones_validas(self):
        respuesta = self.client.patch(f"/api/admin/votaciones/{self.abierta.pk}/", {"presentacion_opciones": "mosaico"}, format="json")
        self.assertEqual(respuesta.data["presentacion_opciones"], "mosaico")
        self.assertEqual(
            self.client.patch(f"/api/admin/votaciones/{self.abierta.pk}/", {"presentacion_opciones": "carrusel"}, format="json").status_code, 400
        )
        respuesta = self.client.patch(f"/api/admin/ediciones/{self.edicion.pk}/", {"presentacion_categorias": "destacada"}, format="json")
        self.assertEqual(respuesta.data["presentacion_categorias"], "destacada")
        publica = self.client.get("/api/votaciones/por-ruta/", {"anio": 2027, "categoria": "musica", "votacion": self.abierta.slug}).data
        self.assertEqual(publica["presentacion_opciones"], "mosaico")

    def test_audio_de_opcion_valida_formato_y_se_borra_al_eliminar(self):
        url = f"/api/admin/opciones/{self.opcion_a.pk}/"
        audio = SimpleUploadedFile("muestra.mp3", b"ID3" + b"\0" * 100, content_type="audio/mpeg")
        respuesta = self.client.patch(url, {"audio": audio, "texto_audio": "Letra de la canción"}, format="multipart")
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertRegex(respuesta.data["audio"], r"^/media/audios/muestra.*\.mp3$")
        self.assertEqual(respuesta.data["texto_audio"], "Letra de la canción")
        malo = SimpleUploadedFile("virus.exe", b"MZ", content_type="application/octet-stream")
        respuesta = self.client.patch(url, {"audio": malo}, format="multipart")
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("MP3", str(respuesta.data["audio"]))
        # La API pública expone el audio y su texto
        publica = self.client.get("/api/opciones/", {"votacion": self.abierta.pk}).data
        self.assertTrue(any(o["audio"] and o["texto_audio"] for o in publica))
        self.opcion_a.refresh_from_db()
        archivo = self.opcion_a.audio
        self.assertEqual(self.client.delete(url).status_code, 204)
        self.assertFalse(archivo.storage.exists(archivo.name))
        registro = RegistroAuditoria.objects.get(accion="eliminar", entidad="opcion")
        self.assertEqual(registro.detalle["nombre"], "Canción A")


class AuditoriaFiltrosTests(BaseAPITest):
    def test_filtra_por_accion_entidad_y_texto(self):
        RegistroAuditoria.objects.create(usuario=self.admin, accion="publicar", entidad="votacion", entidad_id="7")
        RegistroAuditoria.objects.create(usuario=self.admin, accion="crear", entidad="categoria", entidad_id="3")
        RegistroAuditoria.objects.create(usuario=self.votante, accion="crear", entidad="votacion", entidad_id="8")
        self.autenticar(self.admin)
        contar = lambda **f: self.client.get("/api/admin/auditoria/", f).data["count"]  # noqa: E731
        self.assertEqual(contar(), 3)
        self.assertEqual(contar(accion="crear"), 2)
        self.assertEqual(contar(entidad="votacion"), 2)
        self.assertEqual(contar(q="valentina"), 1)
        self.assertEqual(contar(q="7"), 1)
        self.assertEqual(contar(accion="crear", entidad="votacion"), 1)
