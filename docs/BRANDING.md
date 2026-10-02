# Guía de identidad visual (branding)

Sistema Web de Votaciones – Festival de la Leyenda Vallenata 2027 · **Prototipo académico (datos simulados)**.

- **Fuente de los colores:** sitio oficial https://festivalvallenato.com/ (CSS computado e imagen del hero), revisado el **2 de octubre de 2026**.
- **Logo:** el prototipo **no usa el logo oficial**, fotografías ni imágenes de artistas del Festival. Usa una marca gráfica propia y simple (acordeón estilizado) recoloreada en rojo, negro y dorado.
- **Implementación:** tokens CSS en [`src/styles/brand.css`](src/styles/brand.css) (`:root`), mapeados a variables de Bootstrap 5 (`--bs-primary`, enlaces, foco, formularios, insignias). Guía interactiva en la ruta **`#/marca`** del prototipo.
- Los colores **funcionales** son derivados para cumplir WCAG 2.1 AA; no son colores del cliente.

## Paleta

### Primarios

| Nombre | Token | HEX | RGB | Uso | vs blanco | vs negro | Par recomendado |
|---|---|---|---|---|---|---|---|
| Rojo Festival | `--flv-rojo` | `#DD3333` | 221, 51, 51 | Botones primarios, enlaces, navegación activa y acentos. | 4.57:1 | 4.60:1 | #FFFFFF → 4.57:1 (AA) |
| Negro Tarima | `--flv-negro` | `#000000` | 0, 0, 0 | Fondo de navbar, hero, banda de cifras y pie de página. | 21.00:1 | 1.00:1 | #FFFFFF → 21.00:1 (AAA) |
| Dorado Leyenda | `--flv-dorado` | `#D7AC70` | 215, 172, 112 | Títulos y detalles SOLO sobre fondos oscuros; números de la cuenta regresiva. | 2.09:1 | 10.02:1 | #000000 → 10.02:1 (AAA) |

### Secundarios

| Nombre | Token | HEX | RGB | Uso | vs blanco | vs negro | Par recomendado |
|---|---|---|---|---|---|---|---|
| Dorado claro | `--flv-dorado-claro` | `#E9D294` | 233, 210, 148 | Etiquetas de la cuenta regresiva y textos secundarios sobre negro. | 1.49:1 | 14.11:1 | #000000 → 14.11:1 (AAA) |
| Crema | `--flv-crema` | `#FCE6CC` | 252, 230, 204 | Fondos suaves, resaltados y avisos informativos. | 1.21:1 | 17.33:1 | #1C1711 → 14.69:1 (AAA) |
| Ocre Valledupar | `--flv-ocre` | `#7D2710` | 125, 39, 16 | Final del degradado del hero (#000000 → #2A0B08 → #7D2710). | 9.68:1 | 2.17:1 | #FFFFFF → 9.68:1 (AAA) |
| Carbón | `--flv-carbon` | `#1C1711` | 28, 23, 17 | Superficies oscuras y texto fuerte sobre fondos claros. | 17.80:1 | 1.18:1 | #E9D294 → 11.96:1 (AAA) |

### Neutros

| Nombre | Token | HEX | RGB | Uso | vs blanco | vs negro | Par recomendado |
|---|---|---|---|---|---|---|---|
| Gris texto | `--flv-gris-texto` | `#555555` | 85, 85, 85 | Texto de cuerpo. | 7.46:1 | 2.82:1 | #F8F8F8 → 7.02:1 (AAA) |
| Gris borde | `--flv-gris-borde` | `#E9E9E9` | 233, 233, 233 | Bordes, divisores y fondo de barras. | 1.21:1 | 17.30:1 | #000000 → 17.30:1 (AAA) |
| Fondo | `--flv-fondo` | `#F8F8F8` | 248, 248, 248 | Fondo general de las páginas. | 1.06:1 | 19.77:1 | #555555 → 7.02:1 (AAA) |
| Blanco | `--flv-blanco` | `#FFFFFF` | 255, 255, 255 | Tarjetas, formularios y texto sobre fondos oscuros. | 1.00:1 | 21.00:1 | #000000 → 21.00:1 (AAA) |

### Funcionales (derivados para accesibilidad)

| Nombre | Token | HEX | RGB | Uso | vs blanco | vs negro | Par recomendado |
|---|---|---|---|---|---|---|---|
| Rojo oscuro | `--flv-rojo-hover` | `#B71C1C` | 183, 28, 28 | Hover/presionado del primario, errores y enlaces sobre #F8F8F8. | 6.57:1 | 3.20:1 | #FFFFFF → 6.57:1 (AA) |
| Dorado texto | `--flv-dorado-texto` | `#8A6A2E` | 138, 106, 46 | Dorado cuando se usa como texto sobre blanco. | 5.02:1 | 4.18:1 | #FFFFFF → 5.02:1 (AA) |
| Rojo sobre oscuro | `--flv-rojo-sobre-oscuro` | `#FF5A5A` | 255, 90, 90 | Texto rojo sobre negro o carbón (nav activo). | 3.06:1 | 6.86:1 | #1C1711 → 5.82:1 (AA) |
| Estado Abierta | `--flv-estado-abierta` | `#2E7D32` | 46, 125, 50 | Insignia «Abierta» (texto blanco). | 5.13:1 | 4.10:1 | #FFFFFF → 5.13:1 (AA) |
| Estado Programada | `--flv-estado-programada` | `#8A6A2E` | 138, 106, 46 | Insignia «Programada» (texto blanco). | 5.02:1 | 4.18:1 | #FFFFFF → 5.02:1 (AA) |
| Estado Cerrada | `--flv-estado-cerrada` | `#555555` | 85, 85, 85 | Insignia «Cerrada» (texto blanco). | 7.46:1 | 2.82:1 | #FFFFFF → 7.46:1 (AAA) |

**Degradado del hero:** `linear-gradient(135deg, #000000 0%, #2A0B08 55%, #7D2710 100%)`.

## Tipografía

| Uso | Fuente | Pesos |
|---|---|---|
| Títulos (h1–h4, cifras, códigos) | **Raleway** | 800 (y 700 para subtítulos) |
| Texto, navegación, botones, formularios | **Poppins** | 400 / 600 / 700 |

Cargadas desde Google Fonts en `index.html`.

## Reglas de uso

1. **Rojo Festival `#DD3333`** es el color de acción: botones primarios, enlaces, navegación activa y acentos. Texto blanco sobre rojo = 4,57:1 (AA). Hover/presionado: `#B71C1C`.
2. **Enlaces sobre el fondo `#F8F8F8`** usan `#B71C1C` (6,19:1), porque `#DD3333` sobre `#F8F8F8` da 4,30:1 (no cumple AA). Dentro de tarjetas y modales blancos se usa `#DD3333`.
3. **Dorado `#D7AC70` solo sobre fondos oscuros** (negro 10,0:1; ocre 4,62:1). Sobre blanco usar negro o `#8A6A2E` (5,02:1).
4. **Negro `#000000`** para navbar (con borde inferior rojo), hero, banda de cifras/cuenta regresiva, encabezados de tabla, encabezados de modal y pie de página.
5. **Navegación:** enlaces blancos en Poppins 600; el activo en rojo `#FF5A5A` (6,86:1 sobre negro) con subrayado `#DD3333`.
6. **Contenido:** secciones en blanco o `#F8F8F8`, texto `#555555` (7,0:1), títulos Raleway 800 en negro con línea roja decorativa.
7. **Estados de votación:** insignias con texto blanco: Abierta `#2E7D32` (5,13:1), Programada `#8A6A2E` (5,02:1), Cerrada `#555555` (7,46:1).
8. **Avatares de opciones:** combinaciones rojo/blanco, negro/dorado, dorado/negro, ocre/blanco y carbón/dorado claro (todas ≥ 4,5:1).
9. **Foco visible:** contorno rojo de 3 px más halo dorado en todos los controles.
10. Mantener siempre el aviso «Prototipo académico – Areandina · Desarrollo Web 2026 · Datos simulados».
