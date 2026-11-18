"""
Marca editable desde /panel/marca: paleta base, opciones de botones y alertas y cálculo de contraste WCAG.
Debe coincidir con app/web/src/data/marca.js (la web React lee el mismo JSON de ConfiguracionSitio.marca).
"""

import re

GRUPOS_COLOR = [
    {"grupo": "Primarios", "colores": [
        {"token": "--flv-rojo", "nombre": "Rojo Festival", "hex": "#DD3333", "uso": "Botones primarios, enlaces, navegación activa y acentos.", "par": "#FFFFFF"},
        {"token": "--flv-negro", "nombre": "Negro Tarima", "hex": "#000000", "uso": "Fondo de navbar, hero, banda de cifras y pie de página.", "par": "#FFFFFF"},
        {"token": "--flv-dorado", "nombre": "Dorado Leyenda", "hex": "#D7AC70", "uso": "Títulos y detalles solo sobre fondos oscuros; números de la cuenta regresiva.", "par": "#000000"},
    ]},
    {"grupo": "Secundarios", "colores": [
        {"token": "--flv-dorado-claro", "nombre": "Dorado claro", "hex": "#E9D294", "uso": "Etiquetas de la cuenta regresiva y textos secundarios sobre negro.", "par": "#000000"},
        {"token": "--flv-crema", "nombre": "Crema", "hex": "#FCE6CC", "uso": "Fondos suaves, resaltados y avisos informativos.", "par": "#1C1711"},
        {"token": "--flv-ocre", "nombre": "Ocre Valledupar", "hex": "#7D2710", "uso": "Final del degradado del hero y color del botón secundario.", "par": "#FFFFFF"},
        {"token": "--flv-carbon", "nombre": "Carbón", "hex": "#1C1711", "uso": "Superficies oscuras y texto fuerte sobre fondos claros.", "par": "#E9D294"},
    ]},
    {"grupo": "Neutros", "colores": [
        {"token": "--flv-gris-texto", "nombre": "Gris texto", "hex": "#555555", "uso": "Texto de cuerpo.", "par": "#F8F8F8"},
        {"token": "--flv-gris-borde", "nombre": "Gris borde", "hex": "#E9E9E9", "uso": "Bordes, divisores y fondo de barras.", "par": "#000000"},
        {"token": "--flv-fondo", "nombre": "Fondo", "hex": "#F8F8F8", "uso": "Fondo general de las páginas.", "par": "#555555"},
        {"token": "--flv-blanco", "nombre": "Blanco", "hex": "#FFFFFF", "uso": "Tarjetas, formularios y texto sobre fondos oscuros.", "par": "#000000"},
    ]},
    {"grupo": "Funcionales (derivados para accesibilidad)", "colores": [
        {"token": "--flv-rojo-hover", "nombre": "Rojo oscuro", "hex": "#B71C1C", "uso": "Hover del primario, errores y enlaces sobre fondo claro.", "par": "#FFFFFF"},
        {"token": "--flv-dorado-texto", "nombre": "Dorado texto", "hex": "#8A6A2E", "uso": "Dorado cuando se usa como texto sobre blanco.", "par": "#FFFFFF"},
        {"token": "--flv-rojo-sobre-oscuro", "nombre": "Rojo sobre oscuro", "hex": "#FF5A5A", "uso": "Texto rojo sobre negro o carbón (menú activo).", "par": "#1C1711"},
        {"token": "--flv-estado-abierta", "nombre": "Estado Abierta", "hex": "#2E7D32", "uso": "Insignia «Abierta» (texto blanco).", "par": "#FFFFFF"},
        {"token": "--flv-estado-programada", "nombre": "Estado Programada", "hex": "#8A6A2E", "uso": "Insignia «Programada» (texto blanco).", "par": "#FFFFFF"},
        {"token": "--flv-estado-cerrada", "nombre": "Estado Cerrada", "hex": "#555555", "uso": "Insignia «Cerrada» (texto blanco).", "par": "#FFFFFF"},
    ]},
]
TODOS_LOS_COLORES = [color for grupo in GRUPOS_COLOR for color in grupo["colores"]]
COLORES_BASE = {c["token"]: c["hex"] for c in TODOS_LOS_COLORES}

ESTILOS_BOTON = [("relleno", "Relleno"), ("contorno", "Contorno"), ("suave", "Suave"), ("degradado", "Degradado"),
                 ("relieve", "Relieve"), ("texto", "Solo texto")]
FORMAS = [("recta", "Recta"), ("suave", "Suave"), ("redondeada", "Redondeada"), ("pildora", "Píldora")]
PESOS_BOTON = [("500", "Normal"), ("600", "Seminegrita"), ("700", "Negrita"), ("800", "Extranegrita")]
ESTILOS_ALERTA = [("clasico", "Clásico"), ("lateral", "Barra lateral"), ("solido", "Sólido"), ("contorno", "Contorno"),
                  ("tarjeta", "Tarjeta"), ("minimo", "Mínimo")]
ROLES_BOTON = {"primario": "Botón primario", "secundario": "Botón secundario"}
BOTONES_BASE = {
    "primario": {"estilo": "relleno", "color": "", "colorTexto": "", "forma": "suave", "peso": "600", "mayusculas": False},
    "secundario": {"estilo": "contorno", "color": "", "colorTexto": "", "forma": "suave", "peso": "600", "mayusculas": False},
}
ALERTAS_BASE = {"estilo": "clasico", "forma": "suave"}
HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def campo_color(token):
    """--flv-rojo-hover → color_rojo_hover (nombre válido para un campo de formulario)."""
    return "color_" + token.removeprefix("--flv-").replace("-", "_")


def es_hex(valor):
    return isinstance(valor, str) and bool(HEX.match(valor))


def normalizar_marca(marca):
    """Marca guardada (posiblemente incompleta o antigua) → marca completa y válida."""
    marca = marca if isinstance(marca, dict) else {}
    guardados = marca.get("colores") or {}
    colores = {t: (guardados[t].upper() if es_hex(guardados.get(t)) else base) for t, base in COLORES_BASE.items()}
    validos = {"estilo": dict(ESTILOS_BOTON), "forma": dict(FORMAS), "peso": dict(PESOS_BOTON)}
    botones = {}
    for rol, base in BOTONES_BASE.items():
        boton = {**base, **((marca.get("botones") or {}).get(rol) or {})}
        for campo, opciones in validos.items():
            if boton[campo] not in opciones:
                boton[campo] = base[campo]
        for campo in ("color", "colorTexto"):
            boton[campo] = boton[campo].upper() if es_hex(boton[campo]) else ""
        boton["mayusculas"] = bool(boton["mayusculas"])
        botones[rol] = {k: boton[k] for k in base}
    alertas = {**ALERTAS_BASE, **(marca.get("alertas") or {})}
    if alertas["estilo"] not in dict(ESTILOS_ALERTA):
        alertas["estilo"] = ALERTAS_BASE["estilo"]
    if alertas["forma"] not in dict(FORMAS):
        alertas["forma"] = ALERTAS_BASE["forma"]
    return {"colores": colores, "botones": botones, "alertas": {"estilo": alertas["estilo"], "forma": alertas["forma"]}}


def compactar_marca(marca):
    """Marca completa → lo que se guarda: solo lo que difiere de la marca base (vacío = marca base)."""
    resultado = {}
    colores = {t: valor for t, valor in marca["colores"].items() if valor.upper() != COLORES_BASE[t].upper()}
    if colores:
        resultado["colores"] = colores
    botones = {}
    for rol, boton in marca["botones"].items():
        diferencias = {k: v for k, v in boton.items() if v != BOTONES_BASE[rol][k]}
        if diferencias:
            botones[rol] = diferencias
    if botones:
        resultado["botones"] = botones
    alertas = {k: v for k, v in marca["alertas"].items() if v != ALERTAS_BASE[k]}
    if alertas:
        resultado["alertas"] = alertas
    return resultado


def _luminancia(valor):
    canales = [int(valor[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    r, g, b = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in canales]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contraste(a, b):
    claro, oscuro = sorted((_luminancia(a), _luminancia(b)), reverse=True)
    return (claro + 0.05) / (oscuro + 0.05)


def nivel_wcag(razon):
    if razon >= 7:
        return "AAA"
    if razon >= 4.5:
        return "AA"
    if razon >= 3:
        return "AA texto grande"
    return "No cumple"


def texto_legible(fondo):
    return "#000000" if contraste(fondo, "#000000") >= contraste(fondo, "#FFFFFF") else "#FFFFFF"


def fichas(colores):
    """Paleta agrupada con el color vigente, su par recomendado y el contraste WCAG de ese par."""
    grupos = []
    for grupo in GRUPOS_COLOR:
        lista = []
        for color in grupo["colores"]:
            actual = colores[color["token"]]
            razon = contraste(actual, color["par"])
            lista.append({
                **color, "actual": actual, "campo": campo_color(color["token"]),
                "modificado": actual.upper() != color["hex"].upper(), "texto": texto_legible(actual),
                "contraste": f"{razon:.2f}".replace(".", ",") + ":1", "nivel": nivel_wcag(razon), "cumple": razon >= 4.5,
            })
        grupos.append({"grupo": grupo["grupo"], "colores": lista})
    return grupos
