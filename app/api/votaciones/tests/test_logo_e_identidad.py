"""Logo configurable del sitio (API, correos) y PDF/Excel exportados con la identidad visual del sitio."""

import base64
import io
import os
import zlib

from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from votaciones.correo import servicio
from votaciones.models import ConfiguracionSitio, Opcion, RegistroAuditoria, Rol, Usuario, Voto
from votaciones.sitio import identidad
from votaciones.votacion import exportacion

from .base import BaseAPITest

LOGO = "/api/gestion/configuracion/logo/"


def logo_png(nombre="logo.png", tamano=(120, 40), formato="PNG"):
    datos = io.BytesIO()
    Image.new("RGBA", tamano, (30, 90, 200, 255)).save(datos, formato)
    return SimpleUploadedFile(nombre, datos.getvalue(), content_type=f"image/{formato.lower()}")


def texto_pdf(contenido):
    """Flujos de contenido del PDF decodificados (reportlab los guarda en ASCII85 + Flate) para buscar colores y textos."""
    partes = []
    for bloque in contenido.split(b"/ASCII85Decode /FlateDecode ]")[1:]:
        cuerpo = bloque.split(b"stream", 1)[1].split(b"endstream")[0].strip()
        if b"~>" in cuerpo:
            cuerpo = cuerpo[: cuerpo.index(b"~>") + 2]
        try:
            partes.append(zlib.decompress(base64.a85decode(cuerpo, adobe=True)))
        except (ValueError, zlib.error):
            continue
    return b"\n".join(partes)


def color_pdf(hex_):
    """Cómo escribe reportlab un color de relleno RGB (p. ej. «.117647 .352941 .784314 rg»)."""
    canales = [int(hex_[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return " ".join(f"{c:.6f}".rstrip("0").rstrip(".").lstrip("0") or "0" for c in canales).encode()


class LogoApiTests(BaseAPITest):
    def setUp(self):
        super().setUp()
        self.autenticar(self.admin)

    def test_subir_logo_se_expone_en_el_sitio_y_queda_auditado(self):
        respuesta = self.client.post(LOGO, {"logo": logo_png(), "logo_texto_alternativo": " Logo de prueba "}, format="multipart")
        self.assertEqual(respuesta.status_code, 200, respuesta.content)
        self.assertTrue(respuesta.data["logo"].startswith("/media/sitio/"))
        self.assertEqual(respuesta.data["logo_texto_alternativo"], "Logo de prueba")
        publica = self.client.get("/api/sitio/").data["configuracion"]
        self.assertEqual(publica["logo"], respuesta.data["logo"])
        self.assertEqual(publica["logo_texto_alternativo"], "Logo de prueba")
        self.assertTrue(RegistroAuditoria.objects.filter(entidad="configuracion", accion="actualizar",
                                                         detalle__seccion="logo").exists())

    def test_reemplazar_y_quitar_borra_el_archivo_anterior(self):
        self.client.post(LOGO, {"logo": logo_png("uno.png")}, format="multipart")
        primero = ConfiguracionSitio.obtener().logo
        ruta_primero = primero.path
        self.assertTrue(os.path.exists(ruta_primero))
        self.client.post(LOGO, {"logo": logo_png("dos.webp", formato="WEBP")}, format="multipart")
        segundo = ConfiguracionSitio.obtener().logo
        self.assertFalse(os.path.exists(ruta_primero))
        self.assertTrue(os.path.exists(segundo.path))

        respuesta = self.client.delete(LOGO)
        self.assertEqual(respuesta.status_code, 200)
        self.assertIsNone(respuesta.data["logo"])
        self.assertFalse(os.path.exists(segundo.path))
        self.assertFalse(ConfiguracionSitio.obtener().logo)
        self.assertTrue(RegistroAuditoria.objects.filter(detalle__quitado=True).exists())

    def test_rechaza_svg_formatos_no_imagen_y_mas_de_1_mb(self):
        svg = SimpleUploadedFile("logo.svg", b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
                                 content_type="image/svg+xml")
        self.assertEqual(self.client.post(LOGO, {"logo": svg}, format="multipart").status_code, 400)
        grande = io.BytesIO()
        Image.frombytes("RGB", (900, 900), os.urandom(900 * 900 * 3)).save(grande, "PNG")
        self.assertGreater(grande.tell(), 1024 * 1024)
        archivo = SimpleUploadedFile("grande.png", grande.getvalue(), content_type="image/png")
        respuesta = self.client.post(LOGO, {"logo": archivo}, format="multipart")
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("1 MB", str(respuesta.data))
        self.assertFalse(ConfiguracionSitio.obtener().logo)

    def test_texto_alternativo_tambien_por_patch_json(self):
        respuesta = self.client.patch("/api/gestion/configuracion/", {"logo_texto_alternativo": "Acordeón rojo"}, format="json")
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(ConfiguracionSitio.obtener().logo_texto_alternativo, "Acordeón rojo")
        # El logo no se cambia por esta ruta (es de solo lectura aquí)
        self.client.patch("/api/gestion/configuracion/", {"logo": "/media/otro.png"}, format="json")
        self.assertFalse(ConfiguracionSitio.obtener().logo)

    def test_sin_sitio_editar_responde_403(self):
        lector = Usuario.objects.create_user("lectura@festival.test", "Clave2027*segura", nombres="L", apellidos="L",
                                             rol=Usuario.Rol.LECTURA, acepta_tratamiento_datos=True, correo_verificado=True)
        self.autenticar(lector)
        self.assertEqual(self.client.post(LOGO, {"logo": logo_png()}, format="multipart").status_code, 403)
        self.assertEqual(self.client.delete(LOGO).status_code, 403)
        # Un rol propio con sitio.editar sí puede
        Rol.objects.create(codigo="disenador", nombre="Diseño", permisos=["panel.ver", "sitio.ver", "sitio.editar"])
        disenador = Usuario.objects.create_user("diseno@festival.test", "Clave2027*segura", nombres="D", apellidos="D",
                                                rol="disenador", acepta_tratamiento_datos=True, correo_verificado=True)
        self.autenticar(disenador)
        self.assertEqual(self.client.post(LOGO, {"logo": logo_png()}, format="multipart").status_code, 200)
        self.salir()
        self.assertIn(self.client.delete(LOGO).status_code, (401, 403))

    def test_correo_usa_el_logo_configurado(self):
        configuracion = ConfiguracionSitio.obtener()
        self.assertTrue(servicio.url_logo(configuracion).endswith("/static/correo/acordeon.png"))
        self.client.post(LOGO, {"logo": logo_png(tamano=(180, 40))}, format="multipart")
        configuracion.refresh_from_db()
        self.assertIn("/media/sitio/", servicio.url_logo(configuracion))
        self.assertEqual(servicio.ancho_logo(configuracion), 162)  # alto 36 con proporción 180:40


class IdentidadEnExportacionTests(BaseAPITest):
    def setUp(self):
        super().setUp()
        Voto.objects.create(usuario=self.votante, votacion=self.abierta, opcion=self.opcion_a)

    def test_colores_base_coinciden_con_el_portal(self):
        from portal.marca import COLORES_BASE

        self.assertEqual(identidad.COLORES_BASE, COLORES_BASE)

    def test_pdf_con_marca_base_y_logo_por_defecto(self):
        contenido = exportacion.a_pdf(exportacion.reporte_votacion(self.abierta))
        self.assertTrue(contenido.startswith(b"%PDF-"))
        flujo = texto_pdf(contenido)
        self.assertIn(color_pdf("#DD3333"), flujo)  # franja y título en el rojo de la marca
        self.assertIn(b"Fundaci", flujo)  # nombre de la organización en el encabezado
        self.assertIn(b"/Subtype /Image", contenido)  # logo por defecto (acordeón)
        self.assertIn(b"gina 1 de 1", flujo)  # «Página 1 de 1»

    def test_pdf_con_marca_personalizada_y_logo_propio(self):
        configuracion = ConfiguracionSitio.obtener()
        configuracion.marca = {"colores": {"--flv-rojo": "#1E5AC8", "--flv-negro": "#0B1F3A"}}
        configuracion.nombre_organizacion = "Organización de prueba"
        configuracion.save()
        identidad.cambiar_logo(configuracion, logo_png())
        contenido = exportacion.a_pdf(exportacion.reporte_votacion(self.abierta))
        flujo = texto_pdf(contenido)
        self.assertIn(color_pdf("#1E5AC8"), flujo)
        self.assertIn(color_pdf("#0B1F3A"), flujo)
        self.assertNotIn(color_pdf("#DD3333"), flujo)
        self.assertIn(b"Organizaci", flujo)
        self.assertIn(b"/Subtype /Image", contenido)

    def test_color_sin_contraste_se_reemplaza_en_los_textos(self):
        configuracion = ConfiguracionSitio.obtener()
        # Un rojo muy claro no sirve como texto sobre blanco: el título usa una alternativa con contraste AA
        configuracion.marca = {"colores": {"--flv-rojo": "#FFD0D0", "--flv-dorado": "#222222"}}
        configuracion.save()
        colores = exportacion.paleta(configuracion)
        self.assertGreaterEqual(identidad.contraste(colores["titulo"], "#FFFFFF"), 4.5)
        self.assertGreaterEqual(identidad.contraste(colores["acento_banda"], colores["banda"]), 4.5)
        self.assertGreaterEqual(identidad.contraste(colores["texto"], colores["resaltado"]), 4.5)
        self.assertTrue(exportacion.a_pdf(exportacion.reporte_edicion(self.edicion)).startswith(b"%PDF-"))

    def test_logo_ilegible_no_rompe_el_pdf(self):
        configuracion = ConfiguracionSitio.obtener()
        identidad.cambiar_logo(configuracion, logo_png())
        os.remove(configuracion.logo.path)  # el archivo desapareció del disco: se usa el logo por defecto
        self.assertTrue(exportacion.a_pdf(exportacion.reporte_categoria(self.categoria)).startswith(b"%PDF-"))

    def test_excel_usa_los_colores_del_sitio(self):
        from openpyxl import load_workbook

        configuracion = ConfiguracionSitio.obtener()
        configuracion.marca = {"colores": {"--flv-rojo": "#1E5AC8", "--flv-negro": "#0B1F3A"}}
        configuracion.save()
        libro = load_workbook(io.BytesIO(exportacion.a_excel(exportacion.reporte_votacion(self.abierta))))
        self.assertTrue(libro["Resumen"]["A1"].font.color.rgb.endswith("1E5AC8"))
        self.assertTrue(libro["Resultados"]["A1"].fill.fgColor.rgb.endswith("0B1F3A"))

    def test_exportar_por_la_api_con_marca_y_logo(self):
        Opcion.objects.create(votacion=self.abierta, nombre="Canción C", orden=3)
        self.autenticar(self.admin)
        self.client.post(LOGO, {"logo": logo_png()}, format="multipart")
        respuesta = self.client.get(f"/api/gestion/votaciones/{self.abierta.pk}/exportar/?formato=pdf")
        self.assertEqual(respuesta.status_code, 200)
        self.assertTrue(respuesta.content.startswith(b"%PDF-"))
