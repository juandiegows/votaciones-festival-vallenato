# Guion del video – Entrega 2

Duración sugerida: 8 a 10 minutos. Cada integrante aparece en cámara (o con su voz) en su bloque y dice su nombre
al empezar. Grabar con Docker local (`docker compose up -d`) y los datos de `cargar_demo`.

**Antes de grabar**
- No mostrar contraseñas, tokens, el archivo `.env` ni `credencialesDemo.js`. Crear el superusuario fuera de cámara.
- Cerrar pestañas y notificaciones personales.
- Subir el video a YouTube como «No listado» (o a Drive con «Cualquier persona con el enlace») y probar el enlace
  desde una ventana privada.

| # | Bloque | Responsable | Tiempo | Qué mostrar |
|---|---|---|---|---|
| 1 | Presentación | Juan | 0:45 | Equipo, objetivo de la entrega y relación con la Entrega 1 (Edición → Categoría → Votación → Opción) |
| 2 | Estructura del proyecto | Sebastián | 1:30 | `app/api`: proyecto `config`, apps `portal` (MVT) y `votaciones`; `config/urls.py`; `config/base_datos.py` (adaptador MySQL por variables de entorno) |
| 3 | Modelos, relaciones y migraciones | Sebastián | 1:30 | `votacion/models.py` (llaves foráneas y restricciones); `showmigrations`; tablas en MySQL (`SHOW TABLES`) |
| 4 | Panel propio (CRUD) | María | 2:00 | Iniciar sesión como administrador en `/panel`; crear una categoría en la edición 2027; editar una votación y una opción; mostrar Django Admin como respaldo |
| 5 | Visualización dinámica | María | 1:00 | Abrir el sitio (vistas y plantillas Django) y mostrar que la categoría y la opción nuevas ya aparecen; luego borrarlas |
| 6 | Autenticación | Juan | 1:30 | Registro de un votante (aviso de confirmación del correo), inicio y cierre de sesión; explicar `AUTH_USER_MODEL`, `RegistroForm`, `authenticate()`, `login()` y `logout()` |
| 7 | Pruebas | Sebastián | 0:45 | `docker compose exec api python manage.py test` → 219 pruebas OK |
| 8 | Cierre | Los tres | 0:45 | Pendientes para la Entrega 3 y lo que aprendió cada uno (una frase por persona) |
