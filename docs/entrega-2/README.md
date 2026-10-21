# Entrega 2 – Desarrollo inicial del sistema de votaciones

| Contenido | Ubicación |
|---|---|
| Informe (PDF) | [`Eje2_Entrega2_Votaciones_Festival_Vallenato.pdf`](Eje2_Entrega2_Votaciones_Festival_Vallenato.pdf) |
| Capturas de Django Admin, la API, el sitio Django (MVT) y el panel propio con datos de MySQL | [`capturas/`](capturas/) |
| Guion del video demostrativo | [`guion-video.md`](guion-video.md) |
| Instalación y ejecución | [`README.md` raíz](../../README.md#instalación-y-ejecución-django--mysql) |

Fecha límite: 26 de octubre de 2026 · Profesor: Deivys Morales Uribe.

## Capturas

Tomadas el 18 (Django Admin y API) y el 20 de octubre de 2026 (sitio y panel) con Docker local (MySQL 8.4 + API Django + web), escritorio 1366 × 800 px.
Se usaron usuarios temporales de prueba, que se borraron al terminar; ninguna captura muestra contraseñas.

| Archivo | Qué demuestra |
|---|---|
| `01` – `02` | Inicio de sesión en Django Admin y modelos registrados |
| `03` – `05` | Ediciones, categorías y votaciones guardadas en MySQL |
| `06` | Una votación con sus opciones (edición en línea) |
| `07` – `08` | Creación de una categoría desde Django Admin |
| `09` | Usuarios (modelo de usuario propio de Django) |
| `10` | Documentación de la API (Swagger) |
| `11` – `14` | Sitio Django (vistas y plantillas): inicio, categorías, votaciones y detalle con opciones leídas de MySQL |
| `15` – `16` | Registro de un votante con formulario de Django y aviso de confirmación del correo |
| `17` – `19` | Inicio y cierre de sesión (sesión de Django) |
| `20` | La categoría creada en el panel aparece en el sitio sin cambiar código |
| `21` – `28` | Panel propio `/panel`: inicio, ediciones, categorías (nueva y guardada), votaciones y opciones |
