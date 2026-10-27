# Entrega 3 – Módulo de votaciones, validaciones y API GET

| Contenido | Ubicación |
|---|---|
| Informe (PDF) | [`Eje3_Entrega3_Votaciones_Festival_Vallenato.pdf`](Eje3_Entrega3_Votaciones_Festival_Vallenato.pdf) |
| Capturas del flujo de voto, la administración, la API y MySQL | [`capturas/`](capturas/) |
| Guion del video demostrativo | [`guion-video.md`](guion-video.md) |
| Pruebas CP-01 a CP-10 | [`app/api/portal/tests/test_entrega3.py`](../../app/api/portal/tests/test_entrega3.py) |

Fecha límite: 9 de noviembre de 2026 · Profesor: Deivys Morales Uribe.

## Capturas

Tomadas el 27 de octubre de 2026 en local (Django + MySQL 8.4) con los datos de `cargar_demo --reiniciar`, 1366 × 800 px.
Ninguna captura muestra contraseñas ni tokens.

| Archivo | Qué demuestra |
|---|---|
| `01` | Categorías de la edición 2027 leídas de MySQL |
| `02` – `05` | CP-04 (votar sin sesión pide iniciar sesión) y CP-01 (selección, confirmación y comprobante) |
| `06` – `07` | CP-02: «Ya votaste en la categoría» y rechazo del voto enviado desde una pestaña vieja |
| `08` – `09` | CP-03: voto en otra categoría; categoría con el check «Un solo voto en toda la categoría» desmarcado |
| `10` – `11` | CP-05 (votación cerrada) y CP-06 (opción de otra categoría) |
| `12` – `13` | CP-07 «Mis votos» y CP-08 consulta en Django Admin |
| `14` – `15` | Check «Un solo voto en toda la categoría» en el panel y en Django Admin |
| `16` – `17` | CP-10 `GET /api/categorias/` y peticiones directas a la API (401 y 409) |
| `18` – `19` | Pruebas contra MySQL (incluida la concurrencia CP-09) y consultas SQL de los votos y la restricción única |
