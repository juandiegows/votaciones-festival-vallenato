"""
Importar y exportar una edición completa con una plantilla de Excel (Edición → Categorías → Votaciones → Opciones).

La misma plantilla sirve para las dos cosas: vacía (con una fila de ejemplo) para llenarla, o con los datos de una
edición existente para copiarla o respaldarla. Al importar se valida todo antes de guardar: si una fila tiene un
error no se crea nada y se informa la hoja, la fila y el problema.
"""

import io
import re
from datetime import date, datetime, time

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from ..comun.iconos import ICONOS_DISPONIBLES
from .models import Categoria, Edicion, Opcion, Votacion

TAMANO_MAXIMO = 5 * 1024 * 1024
FILAS_MAXIMAS = 3000
ROJO, NEGRO, CREMA = "DD3333", "000000", "FCE6CC"

PRESENTACIONES_CATEGORIAS = dict(Edicion.PresentacionCategorias.choices)
PRESENTACIONES_OPCIONES = dict(Votacion.PresentacionOpciones.choices)
VISIBILIDADES = dict(Votacion.Visibilidad.choices)
SI_NO = ("Sí", "No")
ICONOS = dict(ICONOS_DISPONIBLES)  # nombre técnico → etiqueta («music-note-beamed» → «Notas musicales»)

# Columnas de cada hoja: (encabezado, obligatoria, ancho)
COLUMNAS = {
    "Categorías": [("Nombre", True, 28), ("Identificador URL", False, 22), ("Descripción", False, 44), ("Ícono", False, 20),
                   ("Orden", False, 8), ("Activa", False, 9), ("Un solo voto", False, 13)],
    "Votaciones": [("Categoría", True, 26), ("Título", True, 36), ("Identificador URL", False, 24), ("Descripción", False, 44),
                   ("Apertura", True, 18), ("Cierre", True, 18), ("Presentación de opciones", False, 24),
                   ("Visibilidad propia", False, 18)],
    "Opciones": [("Categoría", True, 26), ("Votación", True, 36), ("Nombre", True, 32), ("Descripción", False, 40),
                 ("Enlace multimedia", False, 32), ("Texto del audio", False, 32), ("Orden", False, 8), ("Activa", False, 9)],
}
CAMPOS_EDICION = [("Nombre", True), ("Año", True), ("Fecha de inicio", True), ("Fecha de fin", True),
                  ("Presentación de categorías", False), ("Visibilidad de resultados", False)]

INSTRUCCIONES = [
    "Plantilla para crear una edición completa del sistema de votaciones.",
    "",
    "1. Hoja «Edición»: llena la columna B. El año no puede repetirse con otra edición.",
    "2. Hoja «Categorías»: una fila por categoría. El nombre no se repite dentro de la edición.",
    "3. Hoja «Votaciones»: una fila por votación; la columna «Categoría» debe coincidir con un nombre de la hoja «Categorías».",
    "4. Hoja «Opciones»: una fila por opción; «Categoría» y «Votación» deben coincidir con las hojas anteriores.",
    "",
    "Columnas con * son obligatorias. Fechas: AAAA-MM-DD; fecha y hora: AAAA-MM-DD HH:MM (hora de Colombia).",
    "Identificador URL: déjalo vacío y se genera desde el nombre (minúsculas, sin tildes, con guiones).",
    "Ícono, Presentación, Visibilidad, Activa, Un solo voto, Categoría y Votación: elige de la lista desplegable de la celda.",
    "Activa y Un solo voto: Sí o No (vacío = Sí).",
    "Visibilidad propia: vacía = la de la edición.",
    "Las votaciones se crean como borrador (sin publicar) para que las revises antes de abrirlas.",
    "Las imágenes, íconos propios y audios se suben después desde el panel.",
    "Borra la fila de ejemplo antes de importar. Si algo falla no se crea nada y verás la hoja y la fila del error.",
]


class ErrorImportacion(Exception):
    def __init__(self, errores):
        super().__init__("La plantilla tiene errores.")
        self.errores = errores


# ---------------------------------------------------------------------------------------------------------------
# Plantilla (vacía o con los datos de una edición)
# ---------------------------------------------------------------------------------------------------------------
def _fecha_hora(valor):
    return timezone.localtime(valor).replace(tzinfo=None) if valor else None


def plantilla_excel(edicion=None):
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Font, PatternFill
    from openpyxl.worksheet.datavalidation import DataValidation

    libro = Workbook()
    hoja = libro.active
    hoja.title = "Instrucciones"
    hoja["A1"] = "Importar una edición"
    hoja["A1"].font = Font(bold=True, size=14, color=ROJO)
    for i, linea in enumerate(INSTRUCCIONES, start=3):
        hoja.cell(row=i, column=1, value=linea)
    hoja.column_dimensions["A"].width = 120

    listas = libro.create_sheet("Listas")
    valores_listas = {
        "A": list(PRESENTACIONES_CATEGORIAS.values()), "B": list(PRESENTACIONES_OPCIONES.values()),
        "C": list(VISIBILIDADES.values()), "D": list(SI_NO), "E": list(ICONOS.values()),
    }
    for columna, valores in valores_listas.items():
        for fila, valor in enumerate(valores, start=1):
            listas[f"{columna}{fila}"] = valor
    listas.sheet_state = "hidden"

    def lista(columna):
        return f"=Listas!${columna}$1:${columna}${len(valores_listas[columna])}"

    def texto(celda, valor):
        celda.value = valor
        if isinstance(valor, str):
            celda.data_type = "s"  # nunca como fórmula

    def encabezados(hoja, columnas):
        for i, (nombre, obligatoria, ancho) in enumerate(columnas, start=1):
            celda = hoja.cell(row=1, column=i, value=nombre + (" *" if obligatoria else ""))
            celda.font = Font(bold=True, color="FFFFFF")
            celda.fill = PatternFill("solid", fgColor=NEGRO)
            celda.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            hoja.column_dimensions[chr(64 + i)].width = ancho
        hoja.freeze_panes = "A2"

    def validar(hoja, formula, rango):
        regla = DataValidation(type="list", formula1=formula, allow_blank=True, showErrorMessage=True,
                               error="Elige un valor de la lista.")
        hoja.add_data_validation(regla)
        regla.add(rango)

    # Edición (clave en A, valor en B)
    hoja_ed = libro.create_sheet("Edición", 1)
    hoja_ed.column_dimensions["A"].width = 30
    hoja_ed.column_dimensions["B"].width = 50
    if edicion:
        valores = [edicion.nombre, edicion.anio, edicion.fecha_inicio, edicion.fecha_fin,
                   PRESENTACIONES_CATEGORIAS.get(edicion.presentacion_categorias), VISIBILIDADES.get(edicion.visibilidad_resultados)]
    else:
        valores = ["Festival de la Leyenda Vallenata 2028", 2028, date(2028, 4, 26), date(2028, 4, 30), "Tarjetas", "Al cierre"]
    for fila, ((etiqueta, obligatoria), valor) in enumerate(zip(CAMPOS_EDICION, valores), start=1):
        celda = hoja_ed.cell(row=fila, column=1, value=etiqueta + (" *" if obligatoria else ""))
        celda.font = Font(bold=True)
        celda.fill = PatternFill("solid", fgColor=CREMA)
        texto(hoja_ed.cell(row=fila, column=2), valor)
        if isinstance(valor, date):
            hoja_ed.cell(row=fila, column=2).number_format = "yyyy-mm-dd"
    validar(hoja_ed, lista("A"), "B5")
    validar(hoja_ed, lista("C"), "B6")

    hojas = {}
    for nombre, columnas in COLUMNAS.items():
        hojas[nombre] = libro.create_sheet(nombre)
        encabezados(hojas[nombre], columnas)

    if edicion:
        categorias = list(edicion.categorias.order_by("orden", "nombre"))
        filas_cat = [[c.nombre, c.slug, c.descripcion, ICONOS.get(c.icono, c.icono), c.orden, "Sí" if c.activa else "No",
                      "Sí" if c.voto_unico else "No"] for c in categorias]
        votaciones = list(Votacion.objects.filter(categoria__edicion=edicion).select_related("categoria")
                          .order_by("categoria__orden", "fecha_apertura", "id"))
        filas_vot = [[v.categoria.nombre, v.titulo, v.slug, v.descripcion, _fecha_hora(v.fecha_apertura),
                      _fecha_hora(v.fecha_cierre), PRESENTACIONES_OPCIONES.get(v.presentacion_opciones),
                      VISIBILIDADES.get(v.visibilidad_resultados) if v.personalizar_resultados else None] for v in votaciones]
        opciones = Opcion.objects.filter(votacion__categoria__edicion=edicion).select_related("votacion__categoria").order_by(
            "votacion__categoria__orden", "votacion__fecha_apertura", "votacion_id", "orden", "id")
        filas_op = [[o.votacion.categoria.nombre, o.votacion.titulo, o.nombre, o.descripcion, o.enlace_multimedia,
                     o.texto_audio, o.orden, "Sí" if o.activa else "No"] for o in opciones]
    else:
        filas_cat = [["Canción inédita", "", "Composiciones nuevas del Festival.", ICONOS["music-note-beamed"], 1, "Sí", "Sí"]]
        filas_vot = [["Canción inédita", "Canción favorita del público", "", "Vota por tu canción inédita favorita.",
                      datetime(2028, 4, 26, 8, 0), datetime(2028, 4, 30, 18, 0), "Tarjetas", None]]
        filas_op = [["Canción inédita", "Canción favorita del público", "Canción de ejemplo", "Aire de paseo.", "", "", 1, "Sí"]]

    for nombre, filas in (("Categorías", filas_cat), ("Votaciones", filas_vot), ("Opciones", filas_op)):
        for r, valores in enumerate(filas, start=2):
            for c, valor in enumerate(valores, start=1):
                celda = hojas[nombre].cell(row=r, column=c)
                texto(celda, valor)
                if isinstance(valor, datetime):
                    celda.number_format = "yyyy-mm-dd hh:mm"

    fin = FILAS_MAXIMAS + 1
    validar(hojas["Categorías"], lista("D"), f"F2:G{fin}")
    validar(hojas["Categorías"], lista("E"), f"D2:D{fin}")
    validar(hojas["Votaciones"], f"='Categorías'!$A$2:$A${fin}", f"A2:A{fin}")
    validar(hojas["Votaciones"], lista("B"), f"G2:G{fin}")
    validar(hojas["Votaciones"], lista("C"), f"H2:H{fin}")
    validar(hojas["Opciones"], f"='Categorías'!$A$2:$A${fin}", f"A2:A{fin}")
    validar(hojas["Opciones"], f"=Votaciones!$B$2:$B${fin}", f"B2:B{fin}")
    validar(hojas["Opciones"], lista("D"), f"H2:H{fin}")
    libro.active = 0

    salida = io.BytesIO()
    libro.save(salida)
    return salida.getvalue()


# ---------------------------------------------------------------------------------------------------------------
# Importación
# ---------------------------------------------------------------------------------------------------------------
def _texto(valor):
    if valor is None:
        return ""
    if isinstance(valor, float) and valor.is_integer():
        valor = int(valor)
    return str(valor).strip()


def _elegir(valor, opciones, campo):
    """Acepta el valor interno (tarjetas) o la etiqueta (Tarjetas), sin importar mayúsculas."""
    texto = _texto(valor).lower()
    if not texto:
        return None
    for clave, etiqueta in opciones.items():
        if texto in (clave.lower(), etiqueta.lower()):
            return clave
    if len(opciones) > 12:
        raise ValueError(f"{campo}: «{_texto(valor)}» no está en la lista; elígelo de la lista desplegable de la celda.")
    raise ValueError(f"{campo}: «{_texto(valor)}» no es válido. Usa: {', '.join(opciones.values())}.")


def _icono(valor):
    """Ícono por su nombre en la lista («Notas musicales») o por su nombre técnico de Bootstrap Icons."""
    texto = _texto(valor)
    if re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", texto):
        return texto
    return _elegir(valor, ICONOS, "Ícono") or ""


def _si_no(valor, campo):
    texto = _texto(valor).lower()
    if texto in ("", "sí", "si", "s", "x", "true", "verdadero", "1"):
        return True
    if texto in ("no", "n", "false", "falso", "0"):
        return False
    raise ValueError(f"{campo}: escribe Sí o No.")


def _entero(valor, campo, defecto=0):
    texto = _texto(valor)
    if not texto:
        return defecto
    try:
        numero = int(float(texto))
    except ValueError:
        raise ValueError(f"{campo}: debe ser un número entero.") from None
    if numero < 0:
        raise ValueError(f"{campo}: no puede ser negativo.")
    return numero


def _fecha(valor, campo):
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    try:
        return date.fromisoformat(_texto(valor)[:10])
    except ValueError:
        raise ValueError(f"{campo}: usa el formato AAAA-MM-DD.") from None


def _fecha_hora_importada(valor, campo):
    if isinstance(valor, datetime):
        momento = valor
    elif isinstance(valor, date):
        momento = datetime.combine(valor, time())
    else:
        texto = _texto(valor).replace("T", " ")
        momento = None
        for formato in ("%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y %H:%M", "%d/%m/%Y"):
            try:
                momento = datetime.strptime(texto, formato)
                break
            except ValueError:
                continue
        if momento is None:
            raise ValueError(f"{campo}: usa el formato AAAA-MM-DD HH:MM.")
    return timezone.make_aware(momento) if timezone.is_naive(momento) else momento


def _mensajes(error):
    if hasattr(error, "message_dict"):
        return [f"{campo if campo != '__all__' else 'Fila'}: {' '.join(m)}" for campo, m in error.message_dict.items()]
    return [" ".join(error.messages)]


def _filas(hoja, columnas):
    """Filas con datos como diccionarios {encabezado: valor}, con su número de fila de Excel."""
    nombres = [nombre for nombre, _, _ in columnas]
    for numero, valores in enumerate(hoja.iter_rows(min_row=2, max_col=len(nombres), values_only=True), start=2):
        if numero > FILAS_MAXIMAS + 1:
            raise ErrorImportacion([{"hoja": hoja.title, "fila": numero, "mensaje": f"Máximo {FILAS_MAXIMAS} filas por hoja."}])
        if any(_texto(v) for v in valores):
            yield numero, dict(zip(nombres, valores))


def leer_libro(archivo):
    from openpyxl import load_workbook

    if archivo.size > TAMANO_MAXIMO:
        raise ErrorImportacion([{"hoja": "", "fila": None, "mensaje": "El archivo supera el tamaño máximo de 5 MB."}])
    inicio = archivo.read(4)
    archivo.seek(0)
    if not archivo.name.lower().endswith(".xlsx") or inicio != b"PK\x03\x04":
        raise ErrorImportacion([{"hoja": "", "fila": None, "mensaje": "Sube la plantilla en formato Excel (.xlsx)."}])
    try:
        libro = load_workbook(archivo, data_only=True, read_only=True)
    except Exception:  # noqa: BLE001 — cualquier archivo dañado se informa igual
        raise ErrorImportacion([{"hoja": "", "fila": None, "mensaje": "No fue posible leer el archivo de Excel."}]) from None
    faltantes = [h for h in ["Edición", *COLUMNAS] if h not in libro.sheetnames]
    if faltantes:
        raise ErrorImportacion([{"hoja": h, "fila": None, "mensaje": "Falta la hoja: usa la plantilla descargada."} for h in faltantes])
    return libro


def importar_excel(archivo, activar=False):
    """Crea la edición de la plantilla con sus categorías, votaciones (en borrador) y opciones. Devuelve la edición."""
    libro = leer_libro(archivo)
    errores = []

    def error(hoja, fila, mensaje):
        errores.append({"hoja": hoja, "fila": fila, "mensaje": mensaje})

    with transaction.atomic():
        # --- Edición
        datos = {}
        for numero, (etiqueta, valor) in enumerate(libro["Edición"].iter_rows(min_row=1, max_row=len(CAMPOS_EDICION),
                                                                               max_col=2, values_only=True), start=1):
            datos[_texto(etiqueta).rstrip(" *")] = (numero, valor)
        edicion = None
        try:
            def campo(nombre):
                return datos.get(nombre, (None, None))[1]

            edicion = Edicion(
                nombre=_texto(campo("Nombre")),
                anio=_entero(campo("Año"), "Año", None),
                fecha_inicio=_fecha(campo("Fecha de inicio"), "Fecha de inicio"),
                fecha_fin=_fecha(campo("Fecha de fin"), "Fecha de fin"),
                presentacion_categorias=_elegir(campo("Presentación de categorías"), PRESENTACIONES_CATEGORIAS,
                                                "Presentación de categorías") or Edicion.PresentacionCategorias.TARJETAS,
                visibilidad_resultados=_elegir(campo("Visibilidad de resultados"), VISIBILIDADES,
                                               "Visibilidad de resultados") or "al_cierre",
                estado=Edicion.Estado.ACTIVA if activar else Edicion.Estado.CERRADA,
            )
            if not edicion.nombre:
                raise ValueError("Nombre: es obligatorio.")
            if edicion.anio is None:
                raise ValueError("Año: es obligatorio.")
            edicion.full_clean()
            edicion.save()
        except ValueError as e:
            error("Edición", None, str(e))
            edicion = None
        except ValidationError as e:
            for mensaje in _mensajes(e):
                error("Edición", None, mensaje)
            edicion = None

        # --- Categorías
        categorias = {}
        for fila, d in _filas(libro["Categorías"], COLUMNAS["Categorías"]):
            try:
                nombre = _texto(d["Nombre"])
                if not nombre:
                    raise ValueError("Nombre: es obligatorio.")
                if nombre.lower() in categorias:
                    raise ValueError(f"La categoría «{nombre}» está repetida.")
                categoria = Categoria(
                    edicion=edicion, nombre=nombre, slug=_texto(d["Identificador URL"]).lower(),
                    descripcion=_texto(d["Descripción"]), icono=_icono(d["Ícono"]),
                    orden=_entero(d["Orden"], "Orden"),
                    activa=_si_no(d["Activa"], "Activa"), voto_unico=_si_no(d["Un solo voto"], "Un solo voto"),
                )
                categorias[nombre.lower()] = categoria
                if edicion:
                    categoria.full_clean(exclude=["slug"] if not categoria.slug else None)
                    categoria.save()
            except ValueError as e:
                error("Categorías", fila, str(e))
            except ValidationError as e:
                for mensaje in _mensajes(e):
                    error("Categorías", fila, mensaje)

        # --- Votaciones
        votaciones = {}
        for fila, d in _filas(libro["Votaciones"], COLUMNAS["Votaciones"]):
            try:
                nombre_categoria, titulo = _texto(d["Categoría"]), _texto(d["Título"])
                categoria = categorias.get(nombre_categoria.lower())
                if not categoria:
                    raise ValueError(f"Categoría: «{nombre_categoria}» no está en la hoja «Categorías».")
                if not titulo:
                    raise ValueError("Título: es obligatorio.")
                clave = (nombre_categoria.lower(), titulo.lower())
                if clave in votaciones:
                    raise ValueError(f"La votación «{titulo}» está repetida en la categoría.")
                visibilidad = _elegir(d["Visibilidad propia"], VISIBILIDADES, "Visibilidad propia")
                votacion = Votacion(
                    categoria=categoria, titulo=titulo, slug=_texto(d["Identificador URL"]).lower(),
                    descripcion=_texto(d["Descripción"]),
                    fecha_apertura=_fecha_hora_importada(d["Apertura"], "Apertura"),
                    fecha_cierre=_fecha_hora_importada(d["Cierre"], "Cierre"),
                    presentacion_opciones=_elegir(d["Presentación de opciones"], PRESENTACIONES_OPCIONES,
                                                  "Presentación de opciones") or Votacion.PresentacionOpciones.TARJETAS,
                    visibilidad_resultados=visibilidad or Votacion.Visibilidad.AL_CIERRE,
                    personalizar_resultados=bool(visibilidad), publicada=False,
                )
                votaciones[clave] = votacion
                if categoria.pk:
                    votacion.full_clean(exclude=["slug"] if not votacion.slug else None)
                    votacion.save()
            except ValueError as e:
                error("Votaciones", fila, str(e))
            except ValidationError as e:
                for mensaje in _mensajes(e):
                    error("Votaciones", fila, mensaje)

        # --- Opciones
        for fila, d in _filas(libro["Opciones"], COLUMNAS["Opciones"]):
            try:
                clave = (_texto(d["Categoría"]).lower(), _texto(d["Votación"]).lower())
                votacion = votaciones.get(clave)
                if not votacion:
                    raise ValueError(f"Votación: «{_texto(d['Votación'])}» no está en la hoja «Votaciones» con esa categoría.")
                nombre = _texto(d["Nombre"])
                if not nombre:
                    raise ValueError("Nombre: es obligatorio.")
                opcion = Opcion(
                    votacion=votacion, nombre=nombre, descripcion=_texto(d["Descripción"]),
                    enlace_multimedia=_texto(d["Enlace multimedia"]), texto_audio=_texto(d["Texto del audio"]),
                    orden=_entero(d["Orden"], "Orden"), activa=_si_no(d["Activa"], "Activa"),
                )
                enlace = opcion.enlace_multimedia
                if enlace and not (enlace.startswith(("http://", "https://")) or enlace.startswith("/")):
                    raise ValueError("Enlace multimedia: usa una URL http(s) o una ruta que empiece por «/».")
                if votacion.pk:
                    opcion.full_clean()
                    opcion.save()
            except ValueError as e:
                error("Opciones", fila, str(e))
            except ValidationError as e:
                for mensaje in _mensajes(e):
                    error("Opciones", fila, mensaje)

        if errores:
            transaction.set_rollback(True)
            raise ErrorImportacion(errores)
        if activar:
            Edicion.objects.filter(estado=Edicion.Estado.ACTIVA).exclude(pk=edicion.pk).update(estado=Edicion.Estado.CERRADA)
    return edicion


def resumen(edicion):
    return {
        "id": edicion.pk, "nombre": edicion.nombre, "anio": edicion.anio, "estado": edicion.estado,
        "categorias": edicion.categorias.count(),
        "votaciones": Votacion.objects.filter(categoria__edicion=edicion).count(),
        "opciones": Opcion.objects.filter(votacion__categoria__edicion=edicion).count(),
    }
