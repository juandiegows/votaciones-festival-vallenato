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

ROJO = "DD3333"
NEGRO = "000000"
DORADO = "D7AC70"
GRIS = "555555"
CREMA = "FCE6CC"

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
# Formatos
# ---------------------------------------------------------------------------------------------------------------
def a_excel(reporte):
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill

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
            celda.font = Font(bold=True, color="FFFFFF")
            celda.fill = PatternFill("solid", fgColor=NEGRO)
            celda.alignment = Alignment(horizontal="center")

    resumen.cell(row=1, column=1, value=reporte["titulo"]).font = Font(bold=True, size=14, color=ROJO)
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


def a_pdf(reporte):
    from xml.sax.saxutils import escape

    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import cm
    from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    salida = io.BytesIO()
    documento = SimpleDocTemplate(
        salida, pagesize=letter, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=2 * cm, bottomMargin=2 * cm,
        title=reporte["titulo"], author="Sistema de votaciones · Festival de la Leyenda Vallenata",
    )
    estilos = getSampleStyleSheet()
    titulo = ParagraphStyle("titulo", parent=estilos["Title"], textColor=colors.HexColor(f"#{ROJO}"), alignment=0)
    subtitulo = ParagraphStyle("subtitulo", parent=estilos["Heading3"], spaceBefore=10, spaceAfter=4)
    normal = ParagraphStyle("normal", parent=estilos["Normal"], fontSize=10, leading=13)
    pequeno = ParagraphStyle("pequeno", parent=normal, fontSize=8.5, textColor=colors.HexColor(f"#{GRIS}"))

    contenido = [Paragraph(escape(reporte["titulo"]), titulo)]
    meta = [[Paragraph(f"<b>{escape(e)}</b>", normal), Paragraph(escape(str(v)), normal)] for e, v in reporte["contexto"]]
    tabla_meta = Table(meta, colWidths=[4 * cm, 13 * cm])
    tabla_meta.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]))
    contenido += [tabla_meta, Spacer(1, 0.4 * cm)]

    def porcentaje(valor):
        return f"{valor:.2f} %".replace(".", ",")

    for s in reporte["secciones"]:
        encabezado = s["votacion"] if reporte["tipo"] == "votacion" else f"{s['categoria']} · {s['votacion']}"
        filas = [["Posición", "Opción", "Votos", "Porcentaje"]]
        for f in s["filas"]:
            filas.append([str(f["posicion"]), Paragraph(escape(f["opcion"]), normal), str(f["votos"]), porcentaje(f["porcentaje"])])
        filas.append(["", Paragraph("<b>Total</b>", normal), str(s["total_votos"]), porcentaje(100 if s["total_votos"] else 0)])
        tabla = Table(filas, colWidths=[2.2 * cm, 9.8 * cm, 2.4 * cm, 2.6 * cm], repeatRows=1)
        estilo = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(f"#{NEGRO}")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor(f"#{DORADO}")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LINEBELOW", (0, 1), (-1, -2), 0.5, colors.HexColor("#E9E9E9")),
            ("LINEABOVE", (0, -1), (-1, -1), 1, colors.HexColor(f"#{NEGRO}")),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]
        if s["total_votos"]:
            # La opción con más votos se resalta (puede haber empate)
            maximo = s["filas"][0]["votos"]
            estilo += [("BACKGROUND", (0, i), (-1, i), colors.HexColor(f"#{CREMA}"))
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
    documento.build(contenido)
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
