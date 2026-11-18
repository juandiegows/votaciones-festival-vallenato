"""Exportación de resultados en varios formatos e importación/exportación de ediciones con la plantilla de Excel."""

import json
from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from openpyxl import load_workbook

from votaciones.models import Categoria, Edicion, Opcion, RegistroAuditoria, Votacion, Voto

from .base import BaseAPITest

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def subir(contenido, nombre="edicion.xlsx"):
    return SimpleUploadedFile(nombre, contenido, content_type=XLSX)


class ExportarResultadosTests(BaseAPITest):
    def setUp(self):
        super().setUp()
        Voto.objects.create(usuario=self.votante, votacion=self.abierta, opcion=self.opcion_a, codigo_comprobante="FLV27-AAAAAA")
        self.autenticar(self.admin)

    def test_todos_los_formatos_para_votacion_categoria_y_edicion(self):
        rutas = {
            "votaciones": self.abierta.pk, "categorias": self.categoria.pk, "ediciones": self.edicion.pk,
        }
        firmas = {"pdf": b"%PDF-", "excel": b"PK", "csv": "﻿".encode(), "json": b"{", "sql": b"--"}
        for coleccion, pk in rutas.items():
            for formato, firma in firmas.items():
                with self.subTest(coleccion=coleccion, formato=formato):
                    respuesta = self.client.get(f"/api/gestion/{coleccion}/{pk}/exportar/", {"formato": formato})
                    self.assertEqual(respuesta.status_code, 200)
                    self.assertTrue(respuesta.content.startswith(firma))
                    self.assertIn("attachment", respuesta["Content-Disposition"])
        self.assertEqual(self.client.get(f"/api/gestion/votaciones/{self.abierta.pk}/exportar/", {"formato": "doc"}).status_code, 400)
        self.assertTrue(RegistroAuditoria.objects.filter(accion="exportar_resultados", entidad="edicion").exists())

    def test_json_y_sql_tienen_los_conteos_sin_votantes(self):
        datos = json.loads(self.client.get(f"/api/gestion/ediciones/{self.edicion.pk}/exportar/", {"formato": "json"}).content)
        resultados = datos["votaciones"][0]["resultados"]
        self.assertEqual(resultados[0], {"posicion": 1, "opcion": "Canción A", "votos": 1, "porcentaje": 100.0})
        sql = self.client.get(f"/api/gestion/ediciones/{self.edicion.pk}/exportar/", {"formato": "sql"}).content.decode()
        self.assertIn("CREATE TABLE IF NOT EXISTS resultado_exportado", sql)
        self.assertIn("'Canción A', 1, 100.0", sql)
        for contenido in (json.dumps(datos), sql):
            self.assertNotIn(self.votante.email, contenido)

    def test_sql_escapa_comillas(self):
        self.opcion_b.nombre = "D'Artagnan'); DROP TABLE voto; --"
        self.opcion_b.save()
        sql = self.client.get(f"/api/gestion/votaciones/{self.abierta.pk}/exportar/", {"formato": "sql"}).content.decode()
        self.assertIn("'D''Artagnan''); DROP TABLE voto; --'", sql)

    def test_solo_administradores(self):
        self.autenticar(self.votante)
        self.assertEqual(self.client.get(f"/api/gestion/ediciones/{self.edicion.pk}/exportar/").status_code, 403)
        self.assertEqual(self.client.get("/api/gestion/ediciones/plantilla/").status_code, 403)


class ImportarEdicionTests(BaseAPITest):
    def setUp(self):
        super().setUp()
        self.autenticar(self.admin)

    def plantilla(self):
        respuesta = self.client.get("/api/gestion/ediciones/plantilla/")
        self.assertEqual(respuesta.status_code, 200)
        return load_workbook(BytesIO(respuesta.content))

    def guardar(self, libro):
        salida = BytesIO()
        libro.save(salida)
        return salida.getvalue()

    def test_la_plantilla_de_ejemplo_se_importa_tal_cual(self):
        libro = self.plantilla()
        self.assertEqual(libro.sheetnames[:2], ["Instrucciones", "Edición"])
        respuesta = self.client.post("/api/gestion/ediciones/importar/", {"archivo": subir(self.guardar(libro))}, format="multipart")
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertEqual(respuesta.data["categorias"], 1)
        self.assertEqual(respuesta.data["votaciones"], 1)
        self.assertEqual(respuesta.data["opciones"], 1)
        edicion = Edicion.objects.get(anio=2028)
        # Sin «activar» queda cerrada y la activa sigue siendo la 2027; las votaciones quedan en borrador
        self.assertEqual(edicion.estado, Edicion.Estado.CERRADA)
        self.edicion.refresh_from_db()
        self.assertEqual(self.edicion.estado, Edicion.Estado.ACTIVA)
        votacion = Votacion.objects.get(categoria__edicion=edicion)
        self.assertFalse(votacion.publicada)
        self.assertEqual(votacion.slug, "cancion-favorita-del-publico")
        self.assertTrue(RegistroAuditoria.objects.filter(accion="importar_edicion").exists())

    def test_activar_al_importar_cierra_la_edicion_activa(self):
        archivo = subir(self.guardar(self.plantilla()))
        respuesta = self.client.post("/api/gestion/ediciones/importar/", {"archivo": archivo, "activar": "true"}, format="multipart")
        self.assertEqual(respuesta.status_code, 201)
        self.edicion.refresh_from_db()
        self.assertEqual(self.edicion.estado, Edicion.Estado.CERRADA)
        self.assertEqual(Edicion.objects.get(anio=2028).estado, Edicion.Estado.ACTIVA)

    def test_con_errores_no_crea_nada_y_dice_hoja_y_fila(self):
        libro = self.plantilla()
        libro["Edición"]["B2"] = 2027  # año repetido
        libro["Votaciones"]["A2"] = "Categoría inexistente"
        libro["Opciones"]["C3"] = "Opción sin votación"
        antes = (Edicion.objects.count(), Categoria.objects.count(), Votacion.objects.count(), Opcion.objects.count())
        respuesta = self.client.post("/api/gestion/ediciones/importar/", {"archivo": subir(self.guardar(libro))}, format="multipart")
        self.assertEqual(respuesta.status_code, 400)
        hojas = {(e["hoja"], e["fila"]) for e in respuesta.data["errores"]}
        self.assertIn(("Votaciones", 2), hojas)
        self.assertIn(("Opciones", 3), hojas)
        self.assertTrue(any(e["hoja"] == "Edición" for e in respuesta.data["errores"]))
        self.assertEqual(antes, (Edicion.objects.count(), Categoria.objects.count(), Votacion.objects.count(), Opcion.objects.count()))

    def test_fechas_invalidas_y_listas(self):
        libro = self.plantilla()
        libro["Votaciones"]["F2"] = "2028-04-01 08:00"  # cierre antes de la apertura
        libro["Votaciones"]["G2"] = "Carrusel"
        respuesta = self.client.post("/api/gestion/ediciones/importar/", {"archivo": subir(self.guardar(libro))}, format="multipart")
        self.assertEqual(respuesta.status_code, 400)
        mensajes = " ".join(e["mensaje"] for e in respuesta.data["errores"])
        self.assertIn("Presentación de opciones", mensajes)

    def test_rechaza_archivos_que_no_son_excel(self):
        archivo = SimpleUploadedFile("edicion.xlsx", b"no soy un excel", content_type=XLSX)
        respuesta = self.client.post("/api/gestion/ediciones/importar/", {"archivo": archivo}, format="multipart")
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn(".xlsx", respuesta.data["errores"][0]["mensaje"])

    def test_exportar_estructura_y_volver_a_importar_como_otra_edicion(self):
        respuesta = self.client.get(f"/api/gestion/ediciones/{self.edicion.pk}/exportar-estructura/")
        libro = load_workbook(BytesIO(respuesta.content))
        self.assertEqual(libro["Categorías"]["A2"].value, "Música")
        self.assertEqual(libro["Opciones"].max_row, 3)  # encabezado + 2 opciones
        libro["Edición"]["B1"] = "Copia 2029"
        libro["Edición"]["B2"] = 2029
        respuesta = self.client.post("/api/gestion/ediciones/importar/", {"archivo": subir(self.guardar(libro))}, format="multipart")
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        copia = Edicion.objects.get(anio=2029)
        self.assertEqual(Opcion.objects.filter(votacion__categoria__edicion=copia).count(), 2)
