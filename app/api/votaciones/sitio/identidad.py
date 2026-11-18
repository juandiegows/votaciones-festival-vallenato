"""
Identidad visual del sitio fuera del navegador (PDF, correos): colores vigentes y logo configurado.
Los colores base son los de docs/BRANDING.md y deben coincidir con portal/marca.py y app/web/src/data/marca.js.
"""

from pathlib import Path

from .models import ConfiguracionSitio

COLORES_BASE = {
    "--flv-rojo": "#DD3333", "--flv-negro": "#000000", "--flv-dorado": "#D7AC70", "--flv-dorado-claro": "#E9D294",
    "--flv-crema": "#FCE6CC", "--flv-ocre": "#7D2710", "--flv-carbon": "#1C1711", "--flv-gris-texto": "#555555",
    "--flv-gris-borde": "#E9E9E9", "--flv-fondo": "#F8F8F8", "--flv-blanco": "#FFFFFF", "--flv-rojo-hover": "#B71C1C",
    "--flv-dorado-texto": "#8A6A2E", "--flv-rojo-sobre-oscuro": "#FF5A5A", "--flv-estado-abierta": "#2E7D32",
    "--flv-estado-programada": "#8A6A2E", "--flv-estado-cerrada": "#555555",
}

# Logo por defecto (acordeón propio, el mismo de los correos): PNG con transparencia, se ve sobre fondos oscuros
LOGO_POR_DEFECTO = Path(__file__).resolve().parent.parent / "static" / "correo" / "acordeon.png"


def colores(configuracion=None):
    """Paleta vigente: la marca base con los colores personalizados en /panel/marca encima."""
    configuracion = configuracion or ConfiguracionSitio.obtener()
    propios = (configuracion.marca or {}).get("colores") or {}
    return {**COLORES_BASE, **{token: valor.upper() for token, valor in propios.items() if token in COLORES_BASE}}


def _luminancia(valor):
    canales = [int(valor[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    r, g, b = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in canales]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contraste(a, b):
    claro, oscuro = sorted((_luminancia(a), _luminancia(b)), reverse=True)
    return (claro + 0.05) / (oscuro + 0.05)


def texto_sobre(fondo, *candidatos, minimo=4.5):
    """Primer candidato con contraste AA sobre `fondo`; si ninguno alcanza, blanco o negro (el que contraste más)."""
    for color in candidatos:
        if contraste(fondo, color) >= minimo:
            return color
    return "#000000" if contraste(fondo, "#000000") >= contraste(fondo, "#FFFFFF") else "#FFFFFF"


def logo_raster(configuracion=None):
    """Archivo del logo para incrustarlo (PDF): el subido si se puede abrir, si no el por defecto, o None."""
    configuracion = configuracion or ConfiguracionSitio.obtener()
    if configuracion.logo:
        try:
            with configuracion.logo.open("rb") as archivo:
                return archivo.read()
        except OSError:
            pass  # el archivo se borró del disco: se usa el logo por defecto
    return LOGO_POR_DEFECTO.read_bytes() if LOGO_POR_DEFECTO.exists() else None


def ruta_logo(configuracion=None):
    """Ruta del logo dentro del sitio (/media/… o la estática por defecto), sin dominio."""
    from django.templatetags.static import static

    configuracion = configuracion or ConfiguracionSitio.obtener()
    return configuracion.logo.url if configuracion.logo else static("correo/acordeon.png")


def cambiar_logo(configuracion, archivo=None, texto_alternativo=None, quitar=False):
    """
    Reemplaza el logo (archivo), lo quita (quitar=True) o solo cambia su texto alternativo, y borra del disco el
    archivo anterior. Devuelve si hubo algún cambio.
    """
    anterior = configuracion.logo.name if configuracion.logo else ""
    campos = []
    if archivo:
        configuracion.logo = archivo
        campos.append("logo")
    elif quitar and anterior:
        configuracion.logo = ""
        campos.append("logo")
    if texto_alternativo is not None and texto_alternativo != configuracion.logo_texto_alternativo:
        configuracion.logo_texto_alternativo = texto_alternativo
        campos.append("logo_texto_alternativo")
    if not campos:
        return False
    configuracion.save(update_fields=campos)
    if anterior and anterior != configuracion.logo.name:
        configuracion.logo.storage.delete(anterior)
    return True
