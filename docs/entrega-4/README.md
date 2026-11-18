# Entrega 4 – Consolidación, pruebas integrales y presentación final (en curso)

Registro de lo que se agregó o corrigió después de la Entrega 3. Cada fila apunta al código y a las pruebas que lo
respaldan. Producción: https://votaciones.juandiegows.com (desplegado el 17 de noviembre de 2026).

## Funcionalidades nuevas

### 1. Presentación de opciones «Imágenes con texto»

| | |
|---|---|
| Qué hace | Novena forma de mostrar las opciones de una votación: tarjeta con la imagen grande arriba y el nombre y la descripción debajo (dos por fila en el celular, tres en escritorio). Sin imagen, se usa el avatar con iniciales. |
| Dónde se elige | Formulario de la votación → «Cómo ve el público las opciones» (web `/panel/votaciones` y panel MVT). La vista previa en vivo la incluye. |
| Imagen de la opción | Campo nuevo `Opcion.foto` (migración `0009`): JPG, PNG o WebP de hasta 3 MB (2 MB en el modo demostración), validada con Pillow. Se sube, reemplaza o quita desde el formulario de la opción; el archivo anterior se borra del disco. |
| API | `foto` en `GET /api/opciones/`, en la votación por ruta y en `/api/gestion/opciones/` (multipart; `null` la quita). |
| SEO | Las imágenes de las opciones activas se publican en `sitemap.xml` (extensión `image:`). |
| Código | `votacion/models.py`, `serializers.py`, `portal/formularios.py`, `parciales/opciones_votacion.html`, `presentaciones/OpcionesVotacion.jsx`, `admin/FormularioOpcion.jsx` |
| Pruebas | `test_imagen_de_opcion_valida_formato_se_quita_y_se_borra`, `test_imagenes_con_texto_usa_la_imagen_subida_o_el_avatar` |

> **Pendiente de validación:** qué imágenes puede publicar la Fundación (derechos de imagen de artistas y
> participantes). El prototipo no incluye fotos del Festival; las que se suban son responsabilidad del administrador.
> Debe registrarse como pregunta P-xx en el informe de la entrega.

### 2. Exportar resultados en Excel, PDF y CSV (RF-14)

| | |
|---|---|
| Qué exporta | Encabezado (edición, categoría, votación, estado, total, fecha de generación) y la tabla posición · opción · votos · porcentaje, con la opción líder resaltada. Solo conteos: **nunca** quién votó por cuál (voto secreto). |
| Dónde | Web: `/panel/resultados` → «Exportar resultados» (Excel, PDF, CSV). Panel MVT: `/panel/votos/{id}` → «Exportar Excel» / «Exportar PDF». |
| API | `GET /api/gestion/votaciones/{id}/resultados/excel/` · `…/pdf/` · `…/csv/` (solo administradores). |
| Librerías | `openpyxl` (Excel) y `reportlab` (PDF), en `requirements.txt`. Código común en `votacion/exportacion.py`. |
| Modo demostración | Sin API, el Excel se genera en el navegador (`utils/exportar.js`, `.xlsx` real) y el PDF abre un reporte imprimible («Guardar como PDF»). |
| Seguridad | Los textos se guardan como texto (sin fórmulas) y cada descarga se audita (`exportar_resultados` con el formato). |
| Pruebas | `test_exportar_excel_y_pdf`, `test_excel_no_ejecuta_formulas`, `test_exportar_resultados_en_excel_y_pdf` |

### 3. URL amigable sugerida automáticamente

Al escribir el nombre de una categoría o el título de una votación, el campo «Identificador en la URL» se completa
solo (`Canción inédita` → `cancion-inedita`), sin repetirse dentro de su edición o categoría (agrega `-2`, `-3`…).
Si la persona escribe su propio identificador, la sugerencia se detiene; al editar un elemento que ya tiene URL no se
cambia, para no romper enlaces publicados. Web: `slugSugerido` en `utils/helpers.js`; panel MVT: `portal.js` con la
etiqueta `slugs_usados`. Prueba: `test_formulario_sugiere_la_url_amigable_sin_repetir`.

## Correcciones

| Problema | Solución |
|---|---|
| En el celular el texto del banner del inicio se salía por arriba y el título quedaba cortado. | Imagen y texto comparten la misma celda (CSS grid): si el texto no cabe, el banner crece. Tipografía y márgenes ajustados por debajo de 576 px. |

## SEO y endurecimiento

| Cambio | Archivo |
|---|---|
| Canonical, Open Graph, Twitter Card y enlace al mapa del sitio en todas las páginas del sitio MVT (en producción la raíz la atiende Django). | `portal/templates/portal/base.html`, etiquetas `url_canonica` y `url_sitio` |
| `/sitemap.xml` redirige (301) a `/api/sitemap.xml`. | `config/urls.py`, `nginx.conf`, `.htaccess` |
| `robots.txt` y `X-Robots-Tag: noindex` cubren también recuperar/restablecer clave y completar documento. | `public/robots.txt`, `nginx.conf`, `.htaccess` |
| Respaldos, volcados y archivos de configuración (`.sql`, `.bak`, `.env`, `.log`, `.map`…) responden 404. | `nginx.conf`, `.htaccess` |
| `color-scheme` y enlace al mapa del sitio en la SPA. | `app/web/index.html` |

## Cómo verificar

```bash
cd app/api && python manage.py test                      # 312 pruebas (votaciones y portal)
cd app/web && npm run build
curl -I https://votaciones.juandiegows.com/sitemap.xml    # 301 → /api/sitemap.xml
```

## Pendiente para cerrar la entrega

- Importar y exportar ediciones completas con una plantilla de Excel, y más formatos de exportación (JSON, SQL) para
  votaciones, categorías y ediciones.
- Informe PDF final, video y pruebas integrales con el agente `revisor-qa` (skill `informe-entrega`).
