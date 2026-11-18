"""
Resultados de una votación, una categoría o una edición en PDF, Excel, CSV, JSON o SQL (RF-14).

Lo usan la API y el panel del sitio MVT. Todos los formatos parten del mismo «reporte»: solo conteos por opción,
nunca quién votó por cuál (voto secreto).
"""

import csv
import io
import json

from django.utils import timezone

from .models import Votacion
from .reportes import calcular_resultados

ESTADOS = {"borrador": "Borrador", "programada": "Programada", "abierta": "Abierta", "cerrada": "Cerrada"}
# Una celda de CSV que empieza por estos caracteres se ejecuta como fórmula en Excel o LibreOffice
INICIO_FORMULA = ("=", "+", "-", "@", "\t", "\r")
COLUMNAS = ["Edición", "Categoría", "Votación", "Estado", "Posición", "Opción", "Votos", "Porcentaje"]


# ---------------------------------------------------------------------------------------------------------------
# Reporte (estructura común a todos los formatos)
# ---------------------------------------------------------------------------------------------------------------
def _seccion(votacion):
    datos = calcular_resultados(votacion)
    return {
        "edicion": votacion.categoria.edicion.nombre,
        "categoria": votacion.categoria.nombre,
        "votacion": votacion.titulo,
        "votacion_id": votacion.pk,
        "estado": ESTADOS.get(datos["estado"], datos["estado"]),
        "total_votos": datos["total_votos"],
        "filas": [
            {"posicion": i, "opcion": f["opcion"], "votos": f["votos"], "porcentaje": f["porcentaje"]}
            for i, f in enumerate(datos["resultados"], start=1)
        ],
    }


def _reporte(tipo, titulo, contexto, votaciones, nombre_base):
    secciones = [_seccion(v) for v in votaciones]
    return {
        "tipo": tipo,
        "titulo": titulo,
        "contexto": contexto + [
            ("Votaciones", len(secciones)),
            ("Total de votos", sum(s["total_votos"] for s in secciones)),
            ("Generado", timezone.localtime().strftime("%d/%m/%Y %H:%M")),
        ],
        "secciones": secciones,
        "nombre_base": nombre_base,
    }


def _votaciones(**filtro):
    return (Votacion.objects.filter(**filtro).select_related("categoria__edicion")
            .order_by("categoria__orden", "categoria__nombre", "fecha_apertura", "id"))


def reporte_votacion(votacion):
    categoria = votacion.categoria
    return _reporte(
        "votacion", "Resultados de la votación",
        [("Edición", categoria.edicion.nombre), ("Categoría", categoria.nombre), ("Votación", votacion.titulo)],
        [votacion], f"resultados-votacion-{votacion.pk}",
    )


def reporte_categoria(categoria):
    return _reporte(
        "categoria", "Resultados de la categoría",
        [("Edición", categoria.edicion.nombre), ("Categoría", categoria.nombre)],
        _votaciones(categoria=categoria), f"resultados-categoria-{categoria.pk}",
    )


def reporte_edicion(edicion):
    return _reporte(
        "edicion", "Resultados de la edición", [("Edición", edicion.nombre)],
        _votaciones(categoria__edicion=edicion), f"resultados-edicion-{edicion.anio}",
    )


def filas_planas(reporte):
    for s in reporte["secciones"]:
        for f in s["filas"]:
            yield [s["edicion"], s["categoria"], s["votacion"], s["estado"], f["posicion"], f["opcion"], f["votos"],
                   f["porcentaje"]]


# ---------------------------------------------------------------------------------------------------------------
# Identidad visual de los archivos: colores vigentes del sitio (/panel/marca) con contraste AA garantizado
# ---------------------------------------------------------------------------------------------------------------
def paleta(configuracion=None):
    """
    Colores del reporte a partir de la identidad del sitio (marca base de docs/BRANDING.md con los personalizados
    encima). Cada color de texto se elige con contraste AA (4,5:1) sobre el fondo en que se usa: si el personalizado
    no lo alcanza, se usa una alternativa de la marca o, en último caso, blanco o negro.
    """
    from ..sitio import identidad
    from ..sitio.models import ConfiguracionSitio

    configuracion = configuracion or ConfiguracionSitio.obtener()
    c = identidad.colores(configuracion)
    sobre = identidad.texto_sobre
    blanco, crema, negro = c["--flv-blanco"], c["--flv-crema"], c["--flv-negro"]

    def sobre_todos(fondos, *candidatos):
        for color in candidatos:
            if all(identidad.contraste(fondo, color) >= 4.5 for fondo in fondos):
                return color
        return sobre(fondos[0])

    return {
        "organizacion": configuracion.nombre_organizacion,
        "banda": negro,  # encabezado y cabecera de tablas, como el menú del sitio
        "franja": c["--flv-rojo"],  # línea bajo la banda, como el borde inferior del menú
        "texto_banda": sobre(negro, blanco),
        "acento_banda": sobre(negro, c["--flv-dorado"], c["--flv-dorado-claro"], blanco),
        "titulo": sobre(blanco, c["--flv-rojo"], c["--flv-rojo-hover"], negro),
        "texto": sobre_todos([blanco, crema], c["--flv-carbon"], negro, "#000000"),
        "secundario": sobre(blanco, c["--flv-gris-texto"], c["--flv-carbon"]),
        "resaltado": crema,  # fila de la opción con más votos
        "borde": c["--flv-gris-borde"],
        "logo": identidad.logo_raster(configuracion),
    }


def _hex(color):
    return color.lstrip("#").upper()


# ---------------------------------------------------------------------------------------------------------------
# Formatos
# ---------------------------------------------------------------------------------------------------------------
def a_excel(reporte):
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill

    colores = paleta()
    libro = Workbook()
    resumen = libro.active
    resumen.title = "Resumen"

    def texto(celda, valor):
        # openpyxl guarda como fórmula cualquier texto que empiece por «=»: se fuerza a texto
        celda.value = valor
        if isinstance(valor, str):
            celda.data_type = "s"
        return celda

    def cabecera(hoja, fila, nombres):
        for columna, nombre in enumerate(nombres, start=1):
            celda = hoja.cell(row=fila, column=columna, value=nombre)
            celda.font = Font(bold=True, color=_hex(colores["texto_banda"]))
            celda.fill = PatternFill("solid", fgColor=_hex(colores["banda"]))
            celda.alignment = Alignment(horizontal="center")

    resumen.cell(row=1, column=1, value=reporte["titulo"]).font = Font(bold=True, size=14, color=_hex(colores["titulo"]))
    texto(resumen.cell(row=2, column=1), colores["organizacion"]).font = Font(color=_hex(colores["secundario"]))
    fila = 3
    for etiqueta, valor in reporte["contexto"]:
        resumen.cell(row=fila, column=1, value=etiqueta).font = Font(bold=True)
        texto(resumen.cell(row=fila, column=2), valor)
        fila += 1
    fila += 1
    cabecera(resumen, fila, ["Categoría", "Votación", "Estado", "Votos", "Opción líder"])
    for s in reporte["secciones"]:
        fila += 1
        lider = s["filas"][0]["opcion"] if s["total_votos"] else "—"
        for columna, valor in enumerate([s["categoria"], s["votacion"], s["estado"], s["total_votos"], lider], start=1):
            texto(resumen.cell(row=fila, column=columna), valor)
    for columna, ancho in zip("ABCDE", (24, 40, 14, 10, 40)):
        resumen.column_dimensions[columna].width = ancho

    hoja = libro.create_sheet("Resultados")
    cabecera(hoja, 1, COLUMNAS)
    fila = 1
    for valores in filas_planas(reporte):
        fila += 1
        for columna, valor in enumerate(valores, start=1):
            celda = texto(hoja.cell(row=fila, column=columna), valor)
            if columna == 8:
                celda.value = valor / 100
                celda.number_format = "0.00%"
            elif columna == 5:
                celda.alignment = Alignment(horizontal="center")
    for columna, ancho in zip("ABCDEFGH", (30, 22, 36, 12, 10, 44, 10, 12)):
        hoja.column_dimensions[columna].width = ancho
    hoja.freeze_panes = "A2"
    if fila > 1:
        hoja.auto_filter.ref = f"A1:H{fila}"

    salida = io.BytesIO()
    libro.save(salida)
    return salida.getvalue()


def _logo_png(datos):
    """Logo como PNG en memoria y su proporción (ancho / alto); None si no hay o no se puede leer."""
    from PIL import Image, UnidentifiedImageError

    if not datos:
        return None
    try:
        with Image.open(io.BytesIO(datos)) as imagen:
            imagen.load()
            salida = io.BytesIO()
            imagen.convert("RGBA").save(salida, format="PNG")
            return salida.getvalue(), imagen.width / imagen.height
    except (OSError, UnidentifiedImageError, ValueError, ZeroDivisionError):
        return None


def a_pdf(reporte):
    """
    PDF con la identidad del sitio: banda negra con el logo y el nombre de la organización, franja del color
    primario, títulos en el color primario y pie con la fecha de generación y «Página X de Y».
    Tipografía: Helvetica-Bold y Helvetica en lugar de Raleway 800 y Poppins (sus TTF no están en el repositorio).
    """
    from xml.sax.saxutils import escape

    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import cm
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfgen.canvas import Canvas
    from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    c = paleta()
    color = {clave: colors.HexColor(valor) for clave, valor in c.items() if isinstance(valor, str) and valor.startswith("#")}
    logo = _logo_png(c["logo"])
    generado = timezone.localtime().strftime("%d/%m/%Y a las %H:%M")
    ancho_pagina, alto_pagina = letter
    alto_banda = 2.1 * cm

    def encabezado_y_pie(lienzo, pagina, total):
        lienzo.saveState()
        # Banda superior con la franja del color primario debajo (como el menú del sitio)
        lienzo.setFillColor(color["banda"])
        lienzo.rect(0, alto_pagina - alto_banda, ancho_pagina, alto_banda, stroke=0, fill=1)
        lienzo.setFillColor(color["franja"])
        lienzo.rect(0, alto_pagina - alto_banda - 4, ancho_pagina, 4, stroke=0, fill=1)
        x = 2 * cm
        if logo:
            alto_logo = 1.1 * cm
            ancho_logo = min(alto_logo * logo[1], 5 * cm)
            lienzo.drawImage(ImageReader(io.BytesIO(logo[0])), x, alto_pagina - alto_banda + (alto_banda - alto_logo) / 2,
                             width=ancho_logo, height=alto_logo, mask="auto", preserveAspectRatio=True, anchor="w")
            x += ancho_logo + 0.4 * cm
        lienzo.setFillColor(color["texto_banda"])
        lienzo.setFont("Helvetica-Bold", 12.5)
        lienzo.drawString(x, alto_pagina - alto_banda / 2 + 2, c["organizacion"][:70])
        lienzo.setFillColor(color["acento_banda"])
        lienzo.setFont("Helvetica", 8.5)
        lienzo.drawString(x, alto_pagina - alto_banda / 2 - 10, f"VOTACIONES · {reporte['titulo'].upper()}")
        # Pie: línea, fecha de generación y número de página
        lienzo.setStrokeColor(color["borde"])
        lienzo.setLineWidth(0.8)
        lienzo.line(2 * cm, 1.55 * cm, ancho_pagina - 2 * cm, 1.55 * cm)
        lienzo.setFillColor(color["secundario"])
        lienzo.setFont("Helvetica", 8)
        lienzo.drawString(2 * cm, 1.1 * cm, f"Generado el {generado} · {c['organizacion'][:60]}")
        lienzo.drawRightString(ancho_pagina - 2 * cm, 1.1 * cm, f"Página {pagina} de {total}")
        lienzo.restoreState()

    class LienzoNumerado(Canvas):
        """Dibuja el encabezado y el pie al final, cuando ya se conoce el total de páginas."""

        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self._paginas = []

        def showPage(self):
            self._paginas.append(dict(self.__dict__))
            self._startPage()

        def save(self):
            total = len(self._paginas)
            for numero, estado in enumerate(self._paginas, start=1):
                self.__dict__.update(estado)
                encabezado_y_pie(self, numero, total)
                super().showPage()
            super().save()

    salida = io.BytesIO()
    documento = SimpleDocTemplate(
        salida, pagesize=letter, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=alto_banda + 1.1 * cm,
        bottomMargin=2.2 * cm, title=reporte["titulo"], author=c["organizacion"],
        subject="Sistema de votaciones · Festival de la Leyenda Vallenata",
    )
    estilos = getSampleStyleSheet()
    normal = ParagraphStyle("normal", parent=estilos["Normal"], fontName="Helvetica", fontSize=10, leading=13,
                            textColor=color["texto"])
    titulo = ParagraphStyle("titulo", parent=estilos["Title"], fontName="Helvetica-Bold", fontSize=20, leading=24,
                            textColor=color["titulo"], alignment=0, spaceAfter=4)
    subtitulo = ParagraphStyle("subtitulo", parent=normal, fontName="Helvetica-Bold", fontSize=12.5, leading=16,
                               spaceBefore=12, spaceAfter=2)
    pequeno = ParagraphStyle("pequeno", parent=normal, fontSize=8.5, leading=11, textColor=color["secundario"])
    cabecera = ParagraphStyle("cabecera", parent=normal, fontName="Helvetica-Bold", textColor=color["acento_banda"])
    cabecera_centro = ParagraphStyle("cabecera-centro", parent=cabecera, alignment=1)
    cabecera_derecha = ParagraphStyle("cabecera-derecha", parent=cabecera, alignment=2)

    # Título con la línea decorativa del color primario (como los títulos de sección del sitio)
    linea = Table([[""]], colWidths=[2.2 * cm], rowHeights=[3], hAlign="LEFT")
    linea.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), color["franja"])]))
    contenido = [Paragraph(escape(reporte["titulo"]), titulo), linea, Spacer(1, 0.35 * cm)]
    meta = [[Paragraph(f"<b>{escape(e)}</b>", normal), Paragraph(escape(str(v)), normal)] for e, v in reporte["contexto"]]
    tabla_meta = Table(meta, colWidths=[4 * cm, 13 * cm])
    tabla_meta.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, color["borde"]),
    ]))
    contenido += [tabla_meta, Spacer(1, 0.4 * cm)]

    def porcentaje(valor):
        return f"{valor:.2f} %".replace(".", ",")

    for s in reporte["secciones"]:
        encabezado = s["votacion"] if reporte["tipo"] == "votacion" else f"{s['categoria']} · {s['votacion']}"
        filas = [[Paragraph("Posición", cabecera_centro), Paragraph("Opción", cabecera),
                  Paragraph("Votos", cabecera_derecha), Paragraph("Porcentaje", cabecera_derecha)]]
        for f in s["filas"]:
            filas.append([str(f["posicion"]), Paragraph(escape(f["opcion"]), normal), str(f["votos"]), porcentaje(f["porcentaje"])])
        filas.append(["", Paragraph("<b>Total</b>", normal), str(s["total_votos"]), porcentaje(100 if s["total_votos"] else 0)])
        tabla = Table(filas, colWidths=[2.2 * cm, 9.8 * cm, 2.4 * cm, 2.6 * cm], repeatRows=1)
        estilo = [
            ("BACKGROUND", (0, 0), (-1, 0), color["banda"]),
            ("TEXTCOLOR", (0, 1), (-1, -1), color["texto"]),
            ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LINEBELOW", (0, 1), (-1, -2), 0.5, color["borde"]),
            ("LINEABOVE", (0, -1), (-1, -1), 1.2, color["franja"]),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]
        if s["total_votos"]:
            # La opción con más votos se resalta (puede haber empate)
            maximo = s["filas"][0]["votos"]
            estilo += [("BACKGROUND", (0, i), (-1, i), color["resaltado"])
                       for i, f in enumerate(s["filas"], start=1) if f["votos"] == maximo]
        tabla.setStyle(TableStyle(estilo))
        bloque = [Paragraph(escape(encabezado), subtitulo),
                  Paragraph(f"Estado: {escape(s['estado'])}", pequeno), Spacer(1, 0.15 * cm), tabla]
        if not s["filas"]:
            bloque.append(Paragraph("Esta votación no tiene opciones.", normal))
        contenido.append(KeepTogether(bloque))
    if not reporte["secciones"]:
        contenido.append(Paragraph("No hay votaciones para mostrar.", normal))
    contenido += [
        Spacer(1, 0.8 * cm),
        Paragraph("El voto es secreto: este reporte solo contiene conteos por opción, nunca quién votó por cuál.", pequeno),
    ]
    documento.build(contenido, canvasmaker=LienzoNumerado)
    return salida.getvalue()


def celda_csv(valor):
    texto = str(valor)
    return f"'{texto}" if texto.startswith(INICIO_FORMULA) else texto


def a_csv(reporte):
    salida = io.StringIO()
    escritor = csv.writer(salida)
    escritor.writerow(COLUMNAS)
    for fila in filas_planas(reporte):
        escritor.writerow([celda_csv(v) if isinstance(v, str) else v for v in fila])
    return ("﻿" + salida.getvalue()).encode("utf-8")


def a_json(reporte):
    datos = {
        "titulo": reporte["titulo"],
        "contexto": {e: v for e, v in reporte["contexto"]},
        "votaciones": [
            {k: s[k] for k in ("votacion_id", "edicion", "categoria", "votacion", "estado", "total_votos")}
            | {"resultados": s["filas"]}
            for s in reporte["secciones"]
        ],
    }
    return json.dumps(datos, ensure_ascii=False, indent=2).encode("utf-8")


def _sql(valor):
    if isinstance(valor, (int, float)):
        return str(valor)
    return "'" + str(valor).replace("\\", "\\\\").replace("'", "''") + "'"


def a_sql(reporte):
    """Script para MySQL: crea la tabla `resultado_exportado` (si no existe) e inserta los conteos."""
    generado = timezone.localtime().strftime("%Y-%m-%d %H:%M:%S")
    lineas = [
        f"-- {reporte['titulo']} · Votaciones del Festival de la Leyenda Vallenata",
        f"-- Generado: {generado}. Solo conteos por opción (voto secreto).",
        "SET NAMES utf8mb4;",
        "CREATE TABLE IF NOT EXISTS resultado_exportado (",
        "  id INT AUTO_INCREMENT PRIMARY KEY,",
        "  edicion VARCHAR(150) NOT NULL,",
        "  categoria VARCHAR(120) NOT NULL,",
        "  votacion VARCHAR(150) NOT NULL,",
        "  estado VARCHAR(15) NOT NULL,",
        "  posicion INT NOT NULL,",
        "  opcion VARCHAR(150) NOT NULL,",
        "  votos INT NOT NULL,",
        "  porcentaje DECIMAL(5,2) NOT NULL,",
        "  generado_en DATETIME NOT NULL",
        ") DEFAULT CHARSET=utf8mb4;",
    ]
    filas = list(filas_planas(reporte))
    if filas:
        lineas.append("INSERT INTO resultado_exportado (edicion, categoria, votacion, estado, posicion, opcion, votos, "
                      "porcentaje, generado_en) VALUES")
        valores = [f"  ({', '.join(_sql(v) for v in fila)}, '{generado}')" for fila in filas]
        lineas.append(",\n".join(valores) + ";")
    return ("\n".join(lineas) + "\n").encode("utf-8")


# formato → (extensión, tipo MIME, generador)
FORMATOS = {
    "pdf": ("pdf", "application/pdf", a_pdf),
    "excel": ("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", a_excel),
    "csv": ("csv", "text/csv; charset=utf-8", a_csv),
    "json": ("json", "application/json; charset=utf-8", a_json),
    "sql": ("sql", "application/sql; charset=utf-8", a_sql),
}


def nombre_archivo(reporte, extension):
    return f"{reporte['nombre_base']}-{timezone.localdate():%Y%m%d}.{extension}"


def generar(reporte, formato):
    """(contenido, tipo MIME, nombre de archivo) del reporte en el formato pedido. KeyError si no existe."""
    extension, tipo, funcion = FORMATOS[formato]
    return funcion(reporte), tipo, nombre_archivo(reporte, extension)
