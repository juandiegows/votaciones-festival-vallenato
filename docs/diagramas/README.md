# Diagramas del proyecto

Todos los diagramas viven aquí, con su fuente editable junto a la imagen. Los informes de cada entrega
(`docs/entrega-N/`) y la guía de la API (`docs/api/`) enlazan a esta carpeta.

| Fuente | Cómo se edita |
|---|---|
| `.mmd` | Mermaid: [mermaid.live](https://mermaid.live) o VS Code; se exporta a PNG o SVG. |
| `.vsdx` | Microsoft Visio. |
| `.drawio` | [diagrams.net](https://app.diagrams.net) (gratis); también exporta a `.vsdx` y `.png`. |
| `.svg` | Visio, Inkscape o el navegador. |

## Casos de uso — [`casos-de-uso/`](casos-de-uso/)

| Diagrama | Imagen | Fuente |
|---|---|---|
| Diagrama general (CU-01 a CU-13) | [`general.png`](casos-de-uso/general.png) | [`.svg`](casos-de-uso/general.svg) |
| CU-01 Registrarse como votante | [`CU-01.png`](casos-de-uso/CU-01.png) | [`.vsdx`](casos-de-uso/CU-01.vsdx) · [`.drawio`](casos-de-uso/CU-01.drawio) |
| CU-02 Iniciar y cerrar sesión | [`CU-02.png`](casos-de-uso/CU-02.png) | [`.vsdx`](casos-de-uso/CU-02.vsdx) · [`.drawio`](casos-de-uso/CU-02.drawio) |
| CU-03 Consultar categorías y votaciones | [`CU-03.png`](casos-de-uso/CU-03.png) | [`.vsdx`](casos-de-uso/CU-03.vsdx) · [`.drawio`](casos-de-uso/CU-03.drawio) |
| CU-04 Emitir voto | [`CU-04.png`](casos-de-uso/CU-04.png) | [`.vsdx`](casos-de-uso/CU-04.vsdx) · [`.drawio`](casos-de-uso/CU-04.drawio) |
| CU-05 Gestionar categorías | [`CU-05.png`](casos-de-uso/CU-05.png) | [`.vsdx`](casos-de-uso/CU-05.vsdx) · [`.drawio`](casos-de-uso/CU-05.drawio) |
| CU-06 Gestionar votaciones | [`CU-06.png`](casos-de-uso/CU-06.png) | [`.vsdx`](casos-de-uso/CU-06.vsdx) · [`.drawio`](casos-de-uso/CU-06.drawio) |
| CU-07 Gestionar opciones | [`CU-07.png`](casos-de-uso/CU-07.png) | [`.vsdx`](casos-de-uso/CU-07.vsdx) · [`.drawio`](casos-de-uso/CU-07.drawio) |
| CU-08 Consultar y publicar resultados | [`CU-08.png`](casos-de-uso/CU-08.png) | [`.vsdx`](casos-de-uso/CU-08.vsdx) · [`.drawio`](casos-de-uso/CU-08.drawio) |
| CU-09 a CU-13 (complementarios) | [`CU-09-a-CU-13.png`](casos-de-uso/CU-09-a-CU-13.png) | [`.vsdx`](casos-de-uso/CU-09-a-CU-13.vsdx) · [`.drawio`](casos-de-uso/CU-09-a-CU-13.drawio) |

## Datos — [`datos/`](datos/)

| Diagrama | Imagen | Fuente |
|---|---|---|
| Modelo conceptual (entidades, relaciones y cardinalidades) | [`modelo-conceptual.png`](datos/modelo-conceptual.png) | [`.mmd`](datos/modelo-conceptual.mmd) |
| Entidades del modelo conceptual | [`entidades.png`](datos/entidades.png) | [`.mmd`](datos/entidades.mmd) |
| Entidad-relación (llaves y atributos principales; va en el informe) | [`entidad-relacion.png`](datos/entidad-relacion.png) | [`.mmd`](datos/entidad-relacion.mmd) |
| Modelo físico completo (todas las columnas de la base de datos) | [`modelo-fisico.png`](datos/modelo-fisico.png) | [`.mmd`](datos/modelo-fisico.mmd) |

## Comportamiento — [`comportamiento/`](comportamiento/)

| Diagrama | Imagen | Fuente |
|---|---|---|
| Flujo principal de votación | [`flujo-principal.png`](comportamiento/flujo-principal.png) | [`.mmd`](comportamiento/flujo-principal.mmd) |
| Secuencia: registro, confirmación del correo y voto | [`secuencia-voto.png`](comportamiento/secuencia-voto.png) | [`.mmd`](comportamiento/secuencia-voto.mmd) |
| Estados de una votación | [`estados-votacion.png`](comportamiento/estados-votacion.png) | [`.mmd`](comportamiento/estados-votacion.mmd) |

## Arquitectura — [`arquitectura/`](arquitectura/)

| Diagrama | Imagen | Fuente |
|---|---|---|
| Arquitectura prevista por capas (va en el informe) | [`capas.png`](arquitectura/capas.png) | [`.html`](arquitectura/capas.html) (se abre en el navegador) |
| Arquitectura de la aplicación | [`aplicacion.png`](arquitectura/aplicacion.png) | [`.mmd`](arquitectura/aplicacion.mmd) |
| Integración con el sitio del Festival | [`integracion.png`](arquitectura/integracion.png) | [`.mmd`](arquitectura/integracion.mmd) |
| Conexión prevista entre el frontend y la API (va en el informe) | [`conexion-frontend-api.png`](arquitectura/conexion-frontend-api.png) | [`.mmd`](arquitectura/conexion-frontend-api.mmd) |
| Componentes y despliegue (propuesta) | [`despliegue.png`](arquitectura/despliegue.png) | [`.mmd`](arquitectura/despliegue.mmd) |

El diagrama de despliegue muestra la arquitectura objetivo; hoy en la VPS solo está publicada la web.

## Mantenerlos al día

- Si cambia un modelo de la API, actualiza `datos/modelo-fisico.mmd` y `datos/entidad-relacion.mmd` y regenera las imágenes.
- Si cambia el flujo de voto, actualiza `comportamiento/secuencia-voto.mmd` y `comportamiento/flujo-principal.mmd`.
- Las imágenes de los informes se toman de esta carpeta; después de regenerarlas, vuelve a exportar el PDF de la entrega.
