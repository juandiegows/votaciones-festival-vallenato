# Entrega 1 – Descubrimiento, análisis de requerimientos y diseño inicial

| Contenido | Ubicación |
|---|---|
| Informe (PDF) | [`Eje1_Entrega1_Votaciones_Festival_Vallenato.pdf`](Eje1_Entrega1_Votaciones_Festival_Vallenato.pdf) |
| Diagramas con su fuente editable (casos de uso en Visio y draw.io; el resto en Mermaid) | [`../diagramas/`](../diagramas/README.md) |
| Capturas de la web (móvil y escritorio) | [`capturas/`](capturas/) |
| Identidad visual | [`../BRANDING.md`](../BRANDING.md) |

Fecha límite: 12 de octubre de 2026 · Profesor: Deivys Morales Uribe.

## Diagramas

Están en [`docs/diagramas/`](../diagramas/README.md), compartidos con la guía de la API. Los del informe:

| Figura del informe | Archivo |
|---|---|
| Diagrama general de casos de uso | `casos-de-uso/general` (`.svg`) |
| Un diagrama por caso de uso (CU-01 a CU-08 y CU-09 a CU-13) | `casos-de-uso/CU-xx` (`.vsdx` y `.drawio`) |
| Modelo conceptual | `datos/modelo-conceptual` (`.mmd`) |
| Modelo entidad-relación | `datos/entidad-relacion` (`.mmd`) |
| Flujo principal | `comportamiento/flujo-principal` (`.mmd`) |
| Secuencia del flujo principal | `comportamiento/secuencia-voto` (`.mmd`) |
| Arquitectura de la aplicación e integración | `arquitectura/aplicacion`, `arquitectura/integracion` (`.mmd`) |
| Conexión prevista entre el frontend y la API | `arquitectura/conexion-frontend-api` (`.mmd`) |

## Capturas

Tomadas el 3 de octubre de 2026 sobre la versión actual de la web (Docker local con la API y los datos de prueba).
Cada pantalla tiene versión móvil (`.png`, 390 × 844 px) y de escritorio (`-desktop.png`, 1366 × 768 px).

| N.º | Pantalla | Ruta |
|---|---|---|
| 01 | Inicio | `/` |
| 02 | Registro (con documento) | `/registro` |
| 03 | Inicio de sesión | `/login` |
| 04 | Categorías de la edición | `/2027` |
| 05 | Votaciones de una categoría | `/2027/categorias/{categoría}` |
| 06 | Detalle y opciones de la votación | `/2027/categorias/{categoría}/{votación}` |
| 07 | Confirmación del voto | ventana en el detalle |
| 08 | Comprobante del voto | `…/{votación}/comprobante` |
| 09 | Panel de administración | `/panel` |
| 10 | Ediciones | `/panel/ediciones` |
| 11 | Categorías | `/panel/categorias` |
| 12 | Votaciones y sus opciones | `/panel/votaciones` |
| 13 | Opciones de una votación | `/panel/votaciones/{id}/opciones` |
| 14 | Resultados en tiempo real | `/panel/resultados` |
| 15 | Auditoría | `/panel/auditoria` |
| 16 | Configuración del sitio público | `/panel/configuracion` |
| 17 | Banner del inicio | `/panel/banner` |
| 18 | Revista institucional | `/panel/revista` |
| 19 | Contacto y redes | `/panel/sitio` |
| 20 | Identidad visual (`20-marca-completa.png`: guía extendida) | `/panel/marca` |
| 21 | Aportes del equipo en GitHub (Insights → Contributors) | [graphs/contributors](https://github.com/juandiegows/votaciones-festival-vallenato/graphs/contributors) |
