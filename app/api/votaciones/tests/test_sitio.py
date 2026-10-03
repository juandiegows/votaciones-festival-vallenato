"""Contenido editable del sitio: banners del inicio, revista institucional, datos de contacto y redes sociales."""
import io
import os
from io import StringIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from PIL import Image

from votaciones.models import BannerInicio, ConfiguracionSitio, Edicion, RedSocial, RegistroAuditoria, Revista, Votacion

from .base import BaseAPITest


def imagen(formato="PNG", tamano=(40, 20), aleatoria=False, nombre="banner.png"):
    if aleatoria:
        img = Image.frombytes("RGB", tamano, os.urandom(tamano[0] * tamano[1] * 3))
    else:
        img = Image.new("RGB", tamano, (221, 51, 51))
    datos = io.BytesIO()
    img.save(datos, formato)
    return SimpleUploadedFile(nombre, datos.getvalue(), content_type=f"image/{formato.lower()}")


class SitioPublicoTests(BaseAPITest):
    def test_lectura_publica_solo_elementos_activos(self):
        RedSocial.objects.create(nombre="Facebook", url="https://facebook.com/x", icono="facebook")
        RedSocial.objects.create(nombre="Oculta", url="https://x.com/y", icono="twitter-x", activa=False)
        pasada = Edicion.objects.create(nombre="FLV 2026", anio=2026, fecha_inicio="2026-04-29", fecha_fin="2026-05-03",
                                        estado="cerrada")
        BannerInicio.objects.create(edicion=self.edicion, titulo="Visible", imagen="banners/a.webp", texto_alternativo="A")
        BannerInicio.objects.create(edicion=self.edicion, titulo="Oculto", imagen="banners/b.webp", texto_alternativo="B", activo=False)
        BannerInicio.objects.create(edicion=pasada, titulo="De 2026", imagen="banners/c.webp", texto_alternativo="C")
        datos = self.client.get("/api/sitio/").data
        self.assertEqual(datos["configuracion"]["telefono"], "(+57) 315-746 3143")
        self.assertEqual([r["nombre"] for r in datos["redes"]], ["Facebook"])
        self.assertEqual([b["titulo"] for b in datos["banners"]], ["Visible"])
        self.assertEqual(datos["banners"][0]["imagen"], "/media/banners/a.webp")


class BannerAdminTests(BaseAPITest):
    def crear(self, archivo, **extra):
        datos = {"edicion": self.edicion.pk, "titulo": "Nuevo banner", "texto_alternativo": "Degradado rojo", "imagen": archivo, **extra}
        return self.client.post("/api/admin/banners/", datos, format="multipart")

    def test_solo_administrador(self):
        self.assertEqual(self.client.get("/api/admin/banners/").status_code, 401)
        self.autenticar(self.votante)
        self.assertEqual(self.crear(imagen()).status_code, 403)
        self.assertEqual(self.client.patch("/api/admin/configuracion/", {"telefono": "1"}, format="json").status_code, 403)
        self.assertEqual(self.client.post("/api/admin/redes/", {"nombre": "X", "url": "https://x.com"}, format="json").status_code, 403)

    def test_subir_imagen_valida_queda_auditada_y_se_sirve(self):
        self.autenticar(self.admin)
        respuesta = self.crear(imagen("WEBP", nombre="banner.webp"), enlace_boton="/2027")
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertRegex(respuesta.data["imagen"], r"^/media/banners/banner.*\.webp$")
        self.assertTrue(RegistroAuditoria.objects.filter(accion="crear", entidad="banner").exists())
        self.assertEqual(self.client.get(respuesta.data["imagen"]).status_code, 200)

    def test_banner_requiere_edicion_y_se_filtra_por_edicion(self):
        self.autenticar(self.admin)
        sin_edicion = self.client.post("/api/admin/banners/", {"titulo": "X", "texto_alternativo": "X", "imagen": imagen()},
                                       format="multipart")
        self.assertEqual(sin_edicion.status_code, 400)
        self.assertIn("edicion", sin_edicion.data)
        pasada = Edicion.objects.create(nombre="FLV 2026", anio=2026, fecha_inicio="2026-04-29", fecha_fin="2026-05-03",
                                        estado="cerrada")
        self.assertEqual(self.crear(imagen(), activo=True).status_code, 201)
        self.assertEqual(self.crear(imagen(), edicion=pasada.pk).status_code, 201)
        self.assertEqual(len(self.client.get("/api/admin/banners/", {"edicion": pasada.pk}).data), 1)
        self.assertEqual(len(self.client.get("/api/admin/banners/").data), 2)
        self.assertEqual(self.client.get("/api/admin/banners/", {"edicion": pasada.pk}).data[0]["edicion_anio"], 2026)
        # El sitio público solo muestra los de la edición activa
        self.assertEqual(len(self.client.get("/api/sitio/").data["banners"]), 1)

    def test_rechaza_formato_no_permitido(self):
        self.autenticar(self.admin)
        respuesta = self.crear(imagen("GIF", nombre="banner.gif"))
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("JPG, PNG o WebP", str(respuesta.data["imagen"]))
        texto = SimpleUploadedFile("banner.png", b"no es una imagen", content_type="image/png")
        self.assertEqual(self.crear(texto).status_code, 400)

    def test_rechaza_imagen_de_mas_de_3_mb(self):
        self.autenticar(self.admin)
        grande = imagen(tamano=(1200, 1000), aleatoria=True)
        self.assertGreater(grande.size, 3 * 1024 * 1024)
        respuesta = self.crear(grande)
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("3 MB", str(respuesta.data["imagen"]))

    def test_reordenar_desactivar_y_eliminar_borra_el_archivo(self):
        self.autenticar(self.admin)
        datos = self.crear(imagen()).data
        url = f"/api/admin/banners/{datos['id']}/"
        self.assertEqual(self.client.patch(url, {"orden": 5, "activo": False}, format="json").data["orden"], 5)
        self.assertEqual(self.client.get("/api/sitio/").data["banners"], [])
        archivo = BannerInicio.objects.get().imagen
        self.assertTrue(archivo.storage.exists(archivo.name))
        self.assertEqual(self.client.delete(url).status_code, 204)
        self.assertFalse(archivo.storage.exists(archivo.name))


def pdf(nombre="revista.pdf", contenido=b"%PDF-1.5\n%%EOF\n"):
    return SimpleUploadedFile(nombre, contenido, content_type="application/pdf")


class RevistaAdminTests(BaseAPITest):
    def crear(self, archivo, **extra):
        datos = {"titulo": "Revista 2025", "descripcion": "Edición digital", "archivo": archivo, **extra}
        return self.client.post("/api/admin/revistas/", datos, format="multipart")

    def test_solo_administrador(self):
        self.assertEqual(self.client.get("/api/admin/revistas/").status_code, 401)
        self.autenticar(self.votante)
        self.assertEqual(self.crear(pdf()).status_code, 403)

    def test_subir_pdf_queda_auditado_publico_y_se_sirve(self):
        self.autenticar(self.admin)
        respuesta = self.crear(pdf(), activa=True)
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertRegex(respuesta.data["archivo"], r"^/media/revistas/revista.*\.pdf$")
        self.assertTrue(RegistroAuditoria.objects.filter(accion="crear", entidad="revista").exists())
        self.assertEqual(self.client.get(respuesta.data["archivo"]).status_code, 200)
        self.client.credentials()
        self.assertEqual([r["titulo"] for r in self.client.get("/api/sitio/").data["revistas"]], ["Revista 2025"])

    def test_rechaza_archivo_que_no_es_pdf(self):
        self.autenticar(self.admin)
        disfrazado = self.crear(pdf(contenido=b"no es un pdf"))
        self.assertEqual(disfrazado.status_code, 400)
        self.assertIn("PDF", str(disfrazado.data["archivo"]))
        self.assertEqual(self.crear(pdf(nombre="revista.txt")).status_code, 400)

    def test_desactivar_reemplazar_y_eliminar_borra_los_archivos(self):
        self.autenticar(self.admin)
        datos = self.crear(pdf(), activa=True).data
        url = f"/api/admin/revistas/{datos['id']}/"
        self.assertEqual(self.client.patch(url, {"activa": False}, format="json").status_code, 200)
        self.assertEqual(self.client.get("/api/sitio/").data["revistas"], [])
        anterior = Revista.objects.get().archivo
        self.assertEqual(self.client.patch(url, {"archivo": pdf("nueva.pdf")}, format="multipart").status_code, 200)
        self.assertFalse(anterior.storage.exists(anterior.name))
        actual = Revista.objects.get().archivo
        self.assertEqual(self.client.delete(url).status_code, 204)
        self.assertFalse(actual.storage.exists(actual.name))


class ConfiguracionYRedesTests(BaseAPITest):
    def setUp(self):
        super().setUp()
        self.autenticar(self.admin)

    def test_actualizar_configuracion_queda_auditada(self):
        respuesta = self.client.patch("/api/admin/configuracion/", {"telefono": "(+57) 300 000 0000"}, format="json")
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(ConfiguracionSitio.obtener().telefono, "(+57) 300 000 0000")
        self.assertTrue(RegistroAuditoria.objects.filter(accion="actualizar", entidad="configuracion").exists())
        self.assertEqual(self.client.patch("/api/admin/configuracion/", {"correo": "no-es-correo"}, format="json").status_code, 400)

    def test_modo_del_banner_fijo_o_carrusel(self):
        self.assertEqual(self.client.get("/api/sitio/").data["configuracion"]["modo_banner"], "carrusel")
        self.assertEqual(self.client.patch("/api/admin/configuracion/", {"modo_banner": "fijo"}, format="json").status_code, 200)
        self.assertEqual(ConfiguracionSitio.obtener().modo_banner, "fijo")
        self.assertEqual(self.client.patch("/api/admin/configuracion/", {"modo_banner": "girando"}, format="json").status_code, 400)

    def test_banner_sin_titulo_solo_imagen(self):
        respuesta = self.client.post("/api/admin/banners/", {"edicion": self.edicion.pk, "texto_alternativo": "Cartel del Festival", "imagen": imagen()},
                                     format="multipart")
        self.assertEqual(respuesta.status_code, 201)
        self.assertEqual(respuesta.data["titulo"], "")

    def test_redes_crud_y_validacion(self):
        respuesta = self.client.post("/api/admin/redes/", {"nombre": "TikTok", "url": "https://www.tiktok.com/@x", "icono": "tiktok"}, format="json")
        self.assertEqual(respuesta.status_code, 201)
        self.assertEqual(self.client.post("/api/admin/redes/", {"nombre": "Otra", "url": "https://x.test", "icono": "myspace"}, format="json").status_code, 400)
        self.assertEqual(self.client.post("/api/admin/redes/", {"nombre": "Mal", "url": "javascript:alert(1)", "icono": "globe"}, format="json").status_code, 400)
        self.assertEqual(self.client.delete(f"/api/admin/redes/{respuesta.data['id']}/").status_code, 204)
        self.assertTrue(RegistroAuditoria.objects.filter(accion="eliminar", entidad="red_social").exists())


class CargarDemoSitioYEdicionesPasadasTests(BaseAPITest):
    def setUp(self):
        pass

    def test_ediciones_pasadas_banners_y_redes(self):
        call_command("cargar_demo", stdout=StringIO())
        for anio in (2025, 2026):
            self.assertEqual(Edicion.objects.get(anio=anio).estado, "cerrada")
            pasadas = Votacion.objects.filter(categoria__edicion__anio=anio)
            self.assertTrue(pasadas.exists())
            for votacion in pasadas:
                self.assertEqual(votacion.estado, "cerrada")
                self.assertTrue(votacion.votos.exists())
                self.assertTrue(votacion.votos.first().codigo_comprobante.startswith(f"FLV{anio % 100}-"))
        self.assertEqual(Edicion.objects.get(estado="activa").anio, 2027)
        votacion = self.client.get("/api/votaciones/por-ruta/", {"anio": 2025, "categoria": "musica", "votacion": "cancion-favorita-del-publico"}).data
        self.assertEqual(self.client.get(f"/api/votaciones/{votacion['id']}/resultados/").status_code, 200)
        sitio = self.client.get("/api/sitio/").data
        self.assertEqual([b["titulo"] for b in sitio["banners"]], ["60.º Festival de la Leyenda Vallenata 2027"])
        for anio, numero in ((2025, "58.º"), (2026, "59.º")):
            banners = BannerInicio.objects.filter(edicion__anio=anio)
            self.assertEqual([b.titulo for b in banners], [f"{numero} Festival de la Leyenda Vallenata {anio}"])
        self.assertEqual([r["icono"] for r in sitio["redes"]], ["facebook", "twitter-x", "instagram", "youtube"])
        self.assertEqual(self.client.get(sitio["banners"][0]["imagen"]).status_code, 200)
