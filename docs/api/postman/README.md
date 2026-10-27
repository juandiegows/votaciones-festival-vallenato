# Colección de Postman · Entrega 3

Pruebas CP-01 a CP-10 de la API (`/api/…`) con aserciones automáticas.

| Archivo | Uso |
|---|---|
| `Votaciones_FLV_Entrega3.postman_collection.json` | Colección (Postman v2.1; Bruno la importa con *Import Collection → Postman Collection*) |
| `Produccion.postman_environment.json` | `baseUrl` = https://votaciones.juandiegows.com |
| `Local.postman_environment.json` | `baseUrl` = http://localhost:8096 (Docker) |

## Cómo correrla

1. Reiniciar los datos de prueba: `python manage.py cargar_demo --reiniciar` (en local: `docker compose exec api python manage.py cargar_demo --reiniciar`).
2. Importar la colección y el entorno, y escribir `votantePassword` y `adminPassword` en el entorno (no se guardan en el repositorio; en local con `DJANGO_DEBUG=true` son las documentadas en el README raíz).
3. *Run collection* en orden (carpetas 0 → 3). CP-01, CP-03 y CP-09 crean votos: para repetir, reiniciar los datos.

Con Newman: `npx newman run Votaciones_FLV_Entrega3.postman_collection.json -e Local.postman_environment.json --env-var votantePassword=… --env-var adminPassword=…`

| Carpeta | Peticiones |
|---|---|
| 0 · Consulta pública | CP-10 `GET /api/categorias/` (guarda los IDs) |
| 1 · Sin sesión | CP-04 votar sin token → 401 |
| 2 · Votante | Login · CP-01 voto válido → 201 · CP-02 otra opción y otro subevento → 409 · CP-03 otra categoría → 201 · CP-05 votación cerrada → 409 · CP-06 opción de otra categoría → 400 · CP-07 mis votos · CP-09 dos votos simultáneos → uno 201 y otro 409 · Logout |
| 3 · Administrador | Login · CP-08 `GET /api/gestion/votos/` · sin token → 401 · Logout |

CP-09 envía los dos votos en paralelo con `pm.sendRequest`; está pensada para Postman/Newman.
Verificada con Newman el 27 de octubre de 2026 contra MySQL local: 18 peticiones, 28 aserciones, 0 fallos.
