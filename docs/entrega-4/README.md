# Entrega 4 – Consolidación, pruebas integrales y presentación final

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

### 2. Exportar resultados de votaciones, categorías y ediciones (RF-14)

| | |
|---|---|
| Formatos | **PDF** (reporte con marca), **Excel** `.xlsx` (hoja «Resumen» y hoja «Resultados» con filtros), **CSV**, **JSON** (estructurado) y **SQL** (script para MySQL que crea `resultado_exportado` e inserta los conteos). |
| Qué exporta | Encabezado (edición, categoría, votación, número de votaciones, total de votos y fecha) y, por votación, posición · opción · votos · porcentaje con la líder resaltada. Solo conteos: **nunca** quién votó por cuál (voto secreto). |
| Dónde | Web: menú «Exportar» en cada fila de `/panel/ediciones` y `/panel/categorias`, en el resumen de `/panel/resultados` (edición) y en el detalle de cada votación. Panel MVT: menú «Exportar» en ediciones, categorías y `/panel/votos/{id}`. |
| API | `GET /api/gestion/{votaciones|categorias|ediciones}/{id}/exportar/?formato=pdf|excel|csv|json|sql` (solo administradores). Se conservan `…/votaciones/{id}/resultados/{csv,excel,pdf}/`. |
| Librerías | `openpyxl` (Excel) y `reportlab` (PDF). Código común en `votacion/exportacion.py`. |
| Modo demostración | Sin API, los cinco formatos se generan en el navegador (`utils/exportar.js`); el PDF abre un reporte imprimible («Guardar como PDF»). |
| Seguridad | CSV y Excel guardan los textos como texto (sin fórmulas), el SQL escapa comillas y cada descarga se audita (`exportar_resultados` con el formato). |
| Pruebas | `test_transferencia.ExportarResultadosTests` (15 combinaciones de entidad y formato, escape de SQL, permisos), `test_excel_no_ejecuta_formulas`, `test_plantilla_importar_y_exportar_desde_el_panel` |

### 3. Importar y exportar ediciones completas con una plantilla de Excel

| | |
|---|---|
| Plantilla | Libro con las hojas «Instrucciones», «Edición», «Categorías», «Votaciones» y «Opciones», listas desplegables (presentaciones, visibilidad, Sí/No, categorías) y una fila de ejemplo que se puede importar tal cual. |
| Importar | Se sube la plantilla llena: se valida **todo** antes de guardar (año único, nombres repetidos, fechas, cierre posterior a la apertura, categoría y votación existentes, valores de las listas, enlaces). Con un solo error no se crea nada y se muestra una tabla con hoja, fila y problema. |
| Qué se crea | La edición queda **cerrada** (no visible) salvo que se marque «Activarla al importar» (cierra la activa). Las votaciones quedan en **borrador**. Las URL amigables vacías se generan solas. Imágenes, íconos y audios se suben después. |
| Exportar edición | «Exportar → Plantilla de Excel con los datos» descarga la edición en la misma plantilla: sirve de respaldo y para copiarla a otro año (cambiar nombre y año, y volver a importarla). |
| Dónde | Web: `/panel/ediciones` → «Importar desde Excel» (requiere la API; en el modo demostración se explica que lo procesa el servidor). Panel MVT: `/panel/ediciones` → «Plantilla de Excel» e «Importar edición» (`/panel/ediciones/importar`). |
| API | `GET /api/gestion/ediciones/plantilla/` · `POST /api/gestion/ediciones/importar/` (multipart: `archivo`, `activar`) · `GET /api/gestion/ediciones/{id}/exportar-estructura/`. |
| Límites | `.xlsx` verificado por su firma, máximo 5 MB y 3000 filas por hoja; se audita `importar_edicion` y `exportar_edicion`. |
| Código y pruebas | `votacion/transferencia.py`, `portal/vistas/panel/transferencia.py`, `admin/ImportarEdicion.jsx`, `admin/MenuExportar.jsx` · `test_transferencia.ImportarEdicionTests` (ejemplo, activar, errores sin crear nada, fechas y listas, archivo inválido, exportar y reimportar). |

### 4. URL amigable sugerida automáticamente

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
| Reglas del WAF de Cloudflare documentadas con su impacto en el código. | [`docs/seguridad/cloudflare.md`](../seguridad/cloudflare.md) |

## Cómo verificar

```bash
cd app/api && python manage.py test                      # 323 pruebas (votaciones y portal)
cd app/web && npm run build
curl -I https://votaciones.juandiegows.com/sitemap.xml    # 301 → /api/sitemap.xml
```

## Pendiente para cerrar la entrega

- Sustentación en vivo (la actividad del Eje 4 no pide informe PDF ni video): guía en [`sustentacion.md`](sustentacion.md).
