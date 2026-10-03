"""Genera los íconos PNG y la imagen para redes sociales (Open Graph) de la web.

Salida en app/web/public/: icon-192.png, icon-512.png, apple-touch-icon.png y og-image.png (1200×630).
Redibuja el isotipo de favicon.svg (acordeón estilizado) con la marca de docs/BRANDING.md; no usa el logo
oficial del Festival. Requiere Pillow; descarga Raleway y Poppins de Google Fonts (OFL) a una carpeta temporal.

    python herramientas/seo/generar_imagenes.py
"""

import tempfile
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

RAIZ = Path(__file__).resolve().parents[2]
SALIDA = RAIZ / "app" / "web" / "public"
FUENTES = {
    "Raleway.ttf": "https://github.com/google/fonts/raw/main/ofl/raleway/Raleway%5Bwght%5D.ttf",
    "Poppins-SemiBold.ttf": "https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-SemiBold.ttf",
    "Poppins-Regular.ttf": "https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-Regular.ttf",
}
ROJO, NEGRO, DORADO, CREMA, BLANCO = "#DD3333", "#000000", "#D7AC70", "#FCE6CC", "#FFFFFF"


def fuentes():
    carpeta = Path(tempfile.gettempdir()) / "flv-fuentes"
    carpeta.mkdir(exist_ok=True)
    for nombre, url in FUENTES.items():
        if not (carpeta / nombre).exists():
            urllib.request.urlretrieve(url, carpeta / nombre)
    return carpeta


def isotipo(lado, redondeado=True):
    """favicon.svg (viewBox 64×64) dibujado a `lado` píxeles con supermuestreo."""
    k = 4
    escala = lado * k / 64
    img = Image.new("RGBA", (lado * k, lado * k), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = lambda v: round(v * escala)  # noqa: E731
    d.rounded_rectangle([0, 0, s(64) - 1, s(64) - 1], radius=s(14) if redondeado else 0, fill=ROJO)
    d.rounded_rectangle([s(12), s(20), s(22), s(46)], radius=s(2), fill=NEGRO)
    d.rounded_rectangle([s(42), s(20), s(52), s(46)], radius=s(2), fill=NEGRO)
    puntos = [(22, 22), (26, 44), (30, 22), (34, 44), (38, 22), (42, 44)]
    d.line([(s(x), s(y)) for x, y in puntos], fill=DORADO, width=s(3), joint="curve")
    return img.resize((lado, lado), Image.LANCZOS)


def imagen_social(carpeta):
    ancho, alto = 1200, 630
    img = Image.new("RGB", (ancho, alto), NEGRO)
    d = ImageDraw.Draw(img)
    # Franjas de marca: rojo arriba y dorado abajo
    d.rectangle([0, 0, ancho, 14], fill=ROJO)
    d.rectangle([0, alto - 14, ancho, alto], fill=DORADO)
    icono = isotipo(220)
    img.paste(icono, (90, (alto - 220) // 2), icono)

    titulo = ImageFont.truetype(str(carpeta / "Raleway.ttf"), 76)
    titulo.set_variation_by_axes([800])
    sub = ImageFont.truetype(str(carpeta / "Poppins-SemiBold.ttf"), 34)
    pie = ImageFont.truetype(str(carpeta / "Poppins-Regular.ttf"), 26)
    x = 370
    d.text((x, 150), "VOTACIONES", font=sub, fill=DORADO)
    d.text((x, 200), "Festival de la", font=titulo, fill=BLANCO)
    d.text((x, 285), "Leyenda Vallenata", font=titulo, fill=BLANCO)
    d.rectangle([x, 395, x + 120, 401], fill=ROJO)
    d.text((x, 425), "Vota por tus favoritos de cada categoría", font=pie, fill=CREMA)
    d.text((x, 465), "votaciones.juandiegows.com", font=pie, fill=DORADO)
    return img


def main():
    carpeta = fuentes()
    isotipo(192).save(SALIDA / "icon-192.png", optimize=True)
    isotipo(512).save(SALIDA / "icon-512.png", optimize=True)
    # iOS redondea las esquinas por su cuenta: el ícono va cuadrado y sin transparencia
    isotipo(180, redondeado=False).convert("RGB").save(SALIDA / "apple-touch-icon.png", optimize=True)
    imagen_social(carpeta).save(SALIDA / "og-image.png", optimize=True)
    print(f"Imágenes generadas en {SALIDA}")


if __name__ == "__main__":
    main()
