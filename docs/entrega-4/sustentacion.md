# Sustentación final (Eje 4) – guía rápida

La actividad del Eje 4 es una **sustentación en vivo de 8 minutos** (no pide informe PDF, video ni diapositivas). Esta guía
reúne lo necesario para prepararla: qué demostrar, dónde está cada cosa en el código y respuestas cortas al banco de
preguntas. El guion detallado por integrante lo maneja el equipo aparte.

- Producción: https://votaciones.juandiegows.com · Local: `docker compose up -d --build` → http://localhost:8096
- Datos de prueba: `docker compose exec api python manage.py cargar_demo --reiniciar`
- Administrador `admin@festival.test` / `Admin2027*` · Votante `votante@festival.test` / `Voto2027*` (solo en local)
- Consultas de MySQL para la parte técnica: [`consultas_demo_mysql.sql`](consultas_demo_mysql.sql)

## Antes del turno

1. `docker compose up -d --build` y `cargar_demo --reiniciar` (fechas al día y votante sin votar).
2. `docker compose exec api python manage.py test` en verde (323 pruebas).
3. Abrir: panel (`/panel`) como administrador, sitio público en ventana de incógnito, consola de MySQL y VS Code en `app/api`.
4. Tener a mano una plantilla de edición llena (descargarla en `/panel/ediciones` → «Plantilla de Excel») para mostrar la
   importación si el docente pregunta por el Festival 2028.

## Las 7 funcionalidades obligatorias

| # | Funcionalidad | Qué mostrar | Dónde está |
|---|---|---|---|
| 1 | Administración dinámica | Crear categoría, votación y opciones en `/panel`; publicar. Opcional: **importar una edición completa desde Excel**. | `portal/vistas/panel/*.py`, `votacion/transferencia.py` |
| 2 | Usuarios y permisos | Registro, inicio y cierre de sesión; el votante que entra a `/panel` recibe 403. | `portal/vistas/cuentas.py`, `panel/base.py` (`solo_administrador`) |
| 3 | Votación | Elegir opción → confirmar → comprobante `FLV27-XXXXXX`. | `portal/vistas/votos.py` → `votacion/servicios.py` (`emitir_voto`) |
| 4 | Control de duplicados | Volver a votar en la misma categoría: «Ya votaste en la categoría». En MySQL, el índice único. | `servicios.emitir_voto` + `UniqueConstraint voto_unico_usuario_categoria_edicion` |
| 5 | Resultados | `/panel/votos/{id}` con conteos reales; **Exportar** en PDF, Excel, CSV, JSON o SQL. | `votacion/reportes.py`, `votacion/exportacion.py` |
| 6 | MySQL + Django MVT | Consultas 1–4 de `consultas_demo_mysql.sql`; modelo → tabla → plantilla. | `config/base_datos.py`, `votacion/models.py`, `portal/templates/` |
| 7 | Validaciones | Formulario con errores, votación cerrada, opción ajena, acceso sin permiso (403), importación con errores por hoja y fila. | `portal/formularios.py`, `servicios.py`, `transferencia.py` |

## Banco de preguntas: respuestas cortas

### A. Django y estructura

1. **¿Por qué Django?** Trae ORM, migraciones, autenticación con contraseñas seguras, protección CSRF y panel de
   administración; con Django REST Framework se expone la misma lógica como API. Menos código propio para lo crítico.
2. **Modelos, vistas y plantillas.** Modelos = tablas y reglas de datos (`votacion/models.py`); vistas = reciben la
   petición, validan y deciden la respuesta (`portal/vistas/`); plantillas = HTML que ve el usuario (`portal/templates/portal/`).
3. **¿Dónde están los modelos?** `app/api/votaciones/votacion/models.py` (Edición, Categoría, Votación, Opción, Voto);
   el usuario en `votaciones/cuentas/models.py` (`AUTH_USER_MODEL = "votaciones.Usuario"`).
4. **URL → vista.** `config/urls.py` incluye `portal/urls.py`; cada `path("panel/votos", votos_panel.votos, …)` asocia una
   ruta con su función. La API se enruta con `DefaultRouter` en `votaciones/urls.py`.

### B. MySQL y administración dinámica

5. **Conexión a MySQL.** `config/base_datos.py` (adaptador elegido con `DB_ENGINE=mysql`, driver PyMySQL) con las variables
   `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` del `.env` o de Docker.
6. **Relación entre entidades.** Edición 1–N Categoría 1–N Votación 1–N Opción; el Voto une Usuario y Opción (y copia
   votación, categoría y edición para que MySQL haga cumplir el voto único).
7. **Migraciones.** Archivos versionados que traducen los modelos a tablas (`votaciones/migrations/0001…0009`); se aplican
   con `migrate` (el contenedor lo hace al arrancar). La 0009 agregó la imagen de la opción.
8. **Nueva edición sin tocar código.** Desde `/panel/ediciones` → «Nueva edición», o **importando la plantilla de Excel**
   con todas sus categorías, votaciones y opciones. Al activarla, la anterior se cierra y el sitio público muestra la nueva.

### C. Usuarios y seguridad

9. **Registro e inicio de sesión.** Formulario de registro (correo, documento, aceptación de datos) → correo de
   confirmación → `/login` con la sesión de Django (`portal/vistas/cuentas.py`).
10. **Permisos.** Campo `rol` del usuario; en el sitio MVT, el decorador `solo_administrador`; en la API, `EsAdministrador`
    (`votaciones/comun/permisos.py`).
11. **Contraseñas.** Nunca en texto plano: Django guarda un hash PBKDF2-SHA256 con sal y aplica los validadores de
    `AUTH_PASSWORD_VALIDATORS` (longitud, comunes, numéricas).
12. **Sin permiso.** Sin sesión → redirige al login y vuelve a la página; con sesión de votante → página 403. La API
    responde 401 o 403. Todo queda fuera de los buscadores y las acciones administrativas se auditan.

### D. Votación y resultados

13. **Del clic al voto guardado.** POST con token CSRF → `votar` valida sesión, correo y documento → `emitir_voto` revisa
    que la votación esté abierta, la opción sea de esa votación y no haya voto previo → guarda en una transacción y genera
    el comprobante.
14. **Doble voto.** Doble barrera: la consulta previa en `emitir_voto` y la restricción única de MySQL
    (`usuario + categoría + edición + ámbito`); si llegan dos solicitudes a la vez, MySQL rechaza la segunda.
15. **Votación no activa.** El estado se calcula con las fechas, la publicación y el cierre manual (`Votacion.estado_en`);
    solo «abierta» acepta votos, y la pausa de la edición los suspende todos.
16. **Origen de los resultados.** Consultas agregadas sobre la tabla `voto` (`votacion/reportes.py`,
    `COUNT` por opción); los reportes exportados salen de la misma función.

### E. Pruebas y continuidad

17. **Pruebas.** 323 pruebas automáticas de Django (`manage.py test`): CP-01 a CP-10 de la Entrega 3, concurrencia en
    MySQL, permisos, API, exportación e importación; la integración continua las corre en cada push (GitHub Actions).
18. **Dificultades.** El WAF de Cloudflare bloqueaba `/admin` y `/vendor/` en producción → panel en `/panel` y API en
    `/api/gestion` ([detalle](../seguridad/cloudflare.md)); dos votos simultáneos → restricción única en MySQL; el
    banner se cortaba en el celular → CSS grid.
19. **Reparto.** Juan: coordinación, UX/UI y desarrollo; Sebastián: análisis y modelado; María: investigación y
    documentación. En la demo, María muestra el flujo del votante, Sebastián el del administrador y Juan la parte técnica.
    El trabajo se integró en GitHub (commits de los tres en `main`).
20. **Festival 2028.** Descargar la plantilla, llenarla (o exportar 2027 con «Plantilla de Excel con los datos» y cambiar el
    año), importarla, subir imágenes y audios, revisar y publicar las votaciones y activar la edición. Sin programar.

## Mejoras pendientes (para el cierre)

- Validar con la Fundación los derechos de imagen de artistas y participantes antes de publicar fotos.
- Límite de peticiones en Cloudflare para `/api/auth/*` (hoy lo aplican nginx y DRF).
- Subdominio institucional del Festival (pendiente de validación).
