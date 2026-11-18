"""Resultados de una votación en Excel (.xlsx) y PDF (RF-14). Los usan la API y el panel del sitio MVT."""

from io import BytesIO

from django.utils import timezone

ROJO = "DD3333"
NEGRO = "000000"
DORADO = "D7AC70"
GRIS = "555555"

ESTADOS = {"borrador": "Borrador", "programada": "Programada", "abierta": "Abierta", "cerrada": "Cerrada"}


def nombre_archivo(votacion, extension):
    return f"resultados-votacion-{votacion.pk}-{timezone.localdate():%Y%m%d}.{extension}"


def encabezado(votacion, datos):
    """Datos de contexto que encabezan ambos reportes."""
    categoria = votacion.categoria
    return [
        ("Edición", categoria.edicion.nombre),
        ("Categoría", categoria.nombre),
        ("Votación", votacion.titulo),
        ("Estado", ESTADOS.get(datos["estado"], datos["estado"])),
        ("Total de votos", datos["total_votos"]),
        ("Generado", timezone.localtime().strftime("%d/%m/%Y %H:%M")),
    ]


def resultados_excel(votacion, datos):
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

    libro = Workbook()
    hoja = libro.active
    hoja.title = "Resultados"

    def texto(celda, valor):
        # openpyxl guarda como fórmula cualquier texto que empiece por «=»: se fuerza a texto
        celda.value = valor
        if isinstance(valor, str):
            celda.data_type = "s"
        return celda

    titulo = hoja.cell(row=1, column=1, value="Resultados de la votación")
    titulo.font = Font(bold=True, size=14, color=ROJO)
    fila = 3
    for etiqueta, valor in encabezado(votacion, datos):
        hoja.cell(row=fila, column=1, value=etiqueta).font = Font(bold=True)
        texto(hoja.cell(row=fila, column=2), valor)
        fila += 1

    fila += 1
    borde = Border(bottom=Side(style="thin", color="E9E9E9"))
    for columna, nombre in enumerate(["Posición", "Opción", "Votos", "Porcentaje"], start=1):
        celda = hoja.cell(row=fila, column=columna, value=nombre)
        celda.font = Font(bold=True, color="FFFFFF")
        celda.fill = PatternFill("solid", fgColor=NEGRO)
        celda.alignment = Alignment(horizontal="center")
    inicio_tabla = fila
    for posicion, resultado in enumerate(datos["resultados"], start=1):
        fila += 1
        hoja.cell(row=fila, column=1, value=posicion).alignment = Alignment(horizontal="center")
        texto(hoja.cell(row=fila, column=2), resultado["opcion"])
        hoja.cell(row=fila, column=3, value=resultado["votos"])
        porcentaje = hoja.cell(row=fila, column=4, value=resultado["porcentaje"] / 100)
        porcentaje.number_format = "0.00%"
        for columna in range(1, 5):
            hoja.cell(row=fila, column=columna).border = borde
    fila += 1
    hoja.cell(row=fila, column=2, value="Total").font = Font(bold=True)
    hoja.cell(row=fila, column=3, value=datos["total_votos"]).font = Font(bold=True)
    total_pct = hoja.cell(row=fila, column=4, value=1 if datos["total_votos"] else 0)
    total_pct.number_format = "0.00%"
    total_pct.font = Font(bold=True)

    for columna, ancho in zip("ABCD", (16, 48, 12, 14)):
        hoja.column_dimensions[columna].width = ancho
    hoja.freeze_panes = hoja.cell(row=inicio_tabla + 1, column=1)

    salida = BytesIO()
    libro.save(salida)
    return salida.getvalue()


def resultados_pdf(votacion, datos):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import cm
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    from xml.sax.saxutils import escape

    salida = BytesIO()
    documento = SimpleDocTemplate(
        salida, pagesize=letter, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=2 * cm, bottomMargin=2 * cm,
        title=f"Resultados · {votacion.titulo}", author="Sistema de votaciones · Festival de la Leyenda Vallenata",
    )
    estilos = getSampleStyleSheet()
    titulo = ParagraphStyle("titulo", parent=estilos["Title"], textColor=colors.HexColor(f"#{ROJO}"), alignment=0)
    normal = ParagraphStyle("normal", parent=estilos["Normal"], fontSize=10, leading=13)
    celda = ParagraphStyle("celda", parent=normal, fontSize=10)

    contenido = [Paragraph("Resultados de la votación", titulo)]
    meta = [[Paragraph(f"<b>{escape(e)}</b>", normal), Paragraph(escape(str(v)), normal)] for e, v in encabezado(votacion, datos)]
    tabla_meta = Table(meta, colWidths=[4 * cm, 13 * cm])
    tabla_meta.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]))
    contenido += [tabla_meta, Spacer(1, 0.6 * cm)]

    filas = [["Posición", "Opción", "Votos", "Porcentaje"]]
    for posicion, resultado in enumerate(datos["resultados"], start=1):
        filas.append([
            str(posicion), Paragraph(escape(resultado["opcion"]), celda), str(resultado["votos"]),
            f"{resultado['porcentaje']:.2f} %".replace(".", ","),
        ])
    filas.append(["", Paragraph("<b>Total</b>", celda), str(datos["total_votos"]), "100,00 %" if datos["total_votos"] else "0,00 %"])
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
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    if len(filas) > 2 and datos["total_votos"]:
        # La opción con más votos se resalta (puede haber empate)
        maximo = datos["resultados"][0]["votos"]
        for i, resultado in enumerate(datos["resultados"], start=1):
            if resultado["votos"] == maximo:
                estilo.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#FCE6CC")))
    tabla.setStyle(TableStyle(estilo))
    contenido.append(tabla)
    if not datos["resultados"]:
        contenido.append(Paragraph("Esta votación no tiene opciones.", normal))
    contenido += [
        Spacer(1, 0.8 * cm),
        Paragraph("El voto es secreto: este reporte solo contiene conteos por opción, nunca quién votó por cuál.",
                  ParagraphStyle("nota", parent=normal, fontSize=8.5, textColor=colors.HexColor(f"#{GRIS}"))),
    ]
    documento.build(contenido)
    return salida.getvalue()
