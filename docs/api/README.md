# Documentación de la API

API REST del Sistema Web de Votaciones del Festival de la Leyenda Vallenata (2027 y ediciones futuras), construida con
**Django 5.2 + Django REST Framework** sobre **MySQL**. Código en [`app/api`](../../app/api).

| Recurso | Enlace (entorno local con Docker) |
|---|---|
| Swagger UI (interactivo) | http://localhost:8096/api/docs/ |
| ReDoc | http://localhost:8096/api/redoc/ |
| Esquema OpenAPI 3 | http://localhost:8096/api/esquema/ · copia versionada: [`openapi.yaml`](openapi.yaml) |
| Salud del servicio | http://localhost:8096/api/salud/ |

## Convenciones

- **Base:** `/api/`. Formato JSON en UTF-8; fechas en ISO 8601 con zona horaria (`America/Bogota`).
- **Autenticación:** token. Se obtiene en `POST /api/auth/registro/` o `POST /api/auth/login/` y se envía en
  cada petición protegida con el encabezado `Authorization: Token <token>`.
- **Roles:** `votante` (por defecto al registrarse) y `administrador`. Las rutas `/api/gestion/…` exigen
  administrador; un votante recibe `403`.
- **Límites de uso (throttling):** login y registro 10/min; votar 30/min por usuario; confirmar o reenviar el
  correo 5/min. La IP del cliente sale de `REMOTE_ADDR` o, detrás de proxies declarados en `DJANGO_NUM_PROXIES`,
  de la entrada de `X-Forwarded-For` que agregó el proxy (la que escribe el cliente se ignora).
- **Filtros por ID** (`?categoria=`, `?edicion=`, `?votacion=`, `?anio=`): un valor no numérico devuelve una lista
  vacía, no un error.
- **`publicar-resultados`** recibe `{"publicar": true|false}` validado como booleano; otro valor responde `400`.
- **CSV de resultados:** los nombres que empiezan por `=`, `+`, `-` o `@` se exportan con un apóstrofo delante
  para que Excel no los ejecute como fórmula.

### Respuestas de error

| Código | Cuándo |
|---|---|
| `400` | Datos inválidos o regla de negocio incumplida (p. ej., opción ajena, menos de dos opciones) |
| `401` | Falta el token o es inválido |
| `403` | Sin permiso (rol) o resultados aún no públicos (RN-07) |
| `404` | Recurso inexistente o no publicado |
| `409` | Conflicto con el estado: votación no abierta, límite de votos, eliminar con votos |
| `429` | Demasiadas peticiones |

Las reglas de negocio responden con un cuerpo uniforme:

```json
{ "detail": "Ya alcanzaste el límite de votos de esta votación (RN-04).", "codigo": "limite_votos" }
```

Códigos posibles: `votacion_no_abierta`, `opcion_invalida`, `limite_votos`, `opciones_insuficientes`,
`tiene_votos`, `registros_asociados`.

## Endpoints

### Autenticación

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/api/auth/registro/` | Público | Registra un votante con `tipo_documento` y `numero_documento` únicos; exige `acepta_tratamiento_datos=true` y envía el enlace de confirmación (RF-01, RN-10, RN-13) |
| POST | `/api/auth/confirmar-correo/` | Público | Confirma el correo con el `token` del enlace (vence en 48 h) y envía la bienvenida (RN-14) |
| POST | `/api/auth/reenviar-confirmacion/` | Token | Envía un nuevo enlace de confirmación; `409 correo_ya_confirmado` si ya lo está |
| POST | `/api/auth/login/` | Público | Devuelve `token` y datos del usuario (RF-02) |
| POST | `/api/auth/logout/` | Token | Invalida el token |
| GET | `/api/auth/yo/` | Token | Usuario autenticado |

### Consulta pública

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/ediciones/` · `/api/ediciones/{id}/` | Ediciones del Festival |
| GET | `/api/ediciones/vigente/` | Edición activa más reciente |
| GET | `/api/categorias/?edicion={id}` · `?anio=2027` | Categorías activas; sin parámetro, las de la edición activa (RF-04) |
| GET | `/api/votaciones/?categoria={id}&estado={programada\|abierta\|cerrada}` | Votaciones publicadas (RF-05) |
| GET | `/api/votaciones/?anio=&categoria_slug=&slug=` | Filtros por año de la edición y slugs |
| GET | `/api/votaciones/por-ruta/?anio=2027&categoria=musica&votacion=cancion-favorita-del-publico` | Busca una votación por su URL amigable |
| GET | `/api/votaciones/{id}/` | Detalle con opciones activas y `mis_votos` del usuario (RF-06) |
| GET | `/api/opciones/?votacion={id}` | Opciones activas de votaciones publicadas |
| GET | `/api/votaciones/{id}/resultados/` | Resultados si la visibilidad lo permite (RF-15, RN-07) |
| GET | `/api/sitio/` | Contacto, redes, revistas activas y banners activos **de la edición activa** |

### Votación

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/api/votaciones/{id}/votar/` | Token | Emite un voto `{ "opcion": <id> }` y devuelve el comprobante (RF-07, RF-08) |
| GET | `/api/mis-votos/` | Token | Votos y comprobantes del usuario (RF-09) |

### Administración (rol administrador)

| Método | Ruta | Descripción |
|---|---|---|
| CRUD | `/api/gestion/ediciones/` | Gestión de ediciones (RF-10); `presentacion_categorias`: `tarjetas`, `lista`, `mosaico`, `compacta` o `destacada` |
| GET | `/api/gestion/ediciones/{id}/resumen/` | Votos por categoría → votación → opción de la edición (tablero de resultados) |
| CRUD | `/api/gestion/categorias/?edicion={id}` | Gestión de categorías (RF-11); ícono de la lista (`icono`) o subido (`icono_imagen`, multipart) |
| CRUD | `/api/gestion/votaciones/?categoria={id}` | Gestión de votaciones (RF-12); se crean como **borrador** |
| POST | `/api/gestion/votaciones/{id}/publicar/` | Publica si hay al menos dos opciones activas (RN-06) |
| POST | `/api/gestion/votaciones/{id}/despublicar/` | Retira la votación del sitio; `409 votacion_abierta` mientras está abierta |
| POST | `/api/gestion/votaciones/{id}/cerrar/` | Cierre anticipado |
| GET | `/api/gestion/votaciones/{id}/participacion/` | Quién votó, **nunca por qué opción** (ver «Participación») |
| POST | `/api/gestion/votaciones/{id}/publicar-resultados/` | `{ "publicar": true\|false }` (RF-15) |
| GET | `/api/gestion/votaciones/{id}/resultados/` | Resultados completos, siempre visibles para el administrador (RF-14) |
| GET | `/api/gestion/votaciones/{id}/resultados/csv/` | Exporta los resultados en CSV (RF-14) |
| CRUD | `/api/gestion/opciones/?votacion={id}` | Gestión de opciones (RF-13); `audio` (archivo, multipart) y `texto_audio` (letra o transcripción) |
| GET | `/api/gestion/votos/?votacion={id}` | Votos anónimos (id, votación, opción y fecha; sin votante ni comprobante) para gráficos e indicadores |
| GET | `/api/gestion/usuarios/?rol={votante\|administrador}` | Usuarios registrados (sin contraseñas) |
| CRUD | `/api/gestion/banners/?edicion={id}` | Banners del inicio; cada banner pertenece a una edición (`edicion`, imagen en multipart) |
| CRUD | `/api/gestion/revistas/` | Revista institucional en PDF (`archivo` en multipart, máximo 50 MB); el inicio la muestra como libro que se hojea |
| GET | `/api/gestion/auditoria/?accion=&entidad=&q=` | Registro de auditoría paginado, 50 por página (RF-16, RN-12); `q` busca por usuario o ID |
| GET | `/api/gestion/auditoria/integridad/?edicion={id}` | Verifica que los votos cuadren en cada votación (por defecto, la edición activa) |

`CRUD` = `GET` lista, `POST` crear, `GET/PUT/PATCH/DELETE` sobre `{id}/`. Eliminar una votación u opción con
votos responde `409` (RN-09); eliminar una edición o categoría con elementos asociados también responde `409`.
Toda creación, modificación, eliminación, publicación, despublicación, cierre y exportación queda en la auditoría
(al eliminar se guarda el nombre del elemento en `detalle`).

## Reglas de negocio en la API

| Regla | Dónde se aplica |
|---|---|
| RN-01 Jerarquía Edición → Categoría → Votación → Opción → Voto | Claves foráneas protegidas en los modelos |
| RN-02 Solo usuarios autenticados votan | `POST /votar/` exige token |
| RN-03 Solo se vota entre apertura y cierre | Estado calculado `abierta`; si no, `409 votacion_no_abierta` |
| RN-04 Límite de votos por usuario (configurable, por defecto 1) | `409 limite_votos`, con bloqueo de fila en la transacción |
| RN-05 El voto confirmado no se modifica | No existen endpoints para editar ni borrar votos |
| RN-06 Mínimo dos opciones para publicar | `400 opciones_insuficientes` |
| RN-07 Visibilidad de resultados (`tiempo_real`, `al_cierre`, `no_publicar`) | `403` mientras no sean públicos |
| RN-09 No se elimina con votos | `409 tiene_votos` |
| RN-10 Aceptar el tratamiento de datos | Validación del registro |
| RN-12 Auditoría de acciones administrativas | Tabla `registro_auditoria` |
| RN-13 Una persona, una cuenta: documento (tipo + número) único | Restricción `usuario_documento_unico`; el número se guarda sin puntos ni espacios |
| RN-14 Solo vota quien confirmó su correo | `403 correo_sin_confirmar` en `POST /votar/` |

Una votación **abierta** no se puede despublicar (`409 votacion_abierta`): se espera al cierre o se cierra primero;
programadas y cerradas sí se pueden retirar del sitio con `/despublicar/`. Al activar una edición, las demás
quedan cerradas automáticamente, así el sitio público muestra siempre una sola edición vigente.

### URLs amigables y ediciones futuras

Las categorías y votaciones tienen `slug` (generado desde el nombre, editable por el administrador): único por
edición en las categorías y único por categoría en las votaciones. La web usa rutas como
`/2027/categorias/musica/cancion-favorita-del-publico`; en 2028 basta con crear y activar la nueva edición. Las respuestas
incluyen `slug`, `edicion_anio` y `categoria_slug`. El código del comprobante usa el año de la edición (`FLV27-…`,
`FLV28-…`).

### Multimedia de las opciones

`enlace_multimedia` acepta una URL `http(s)` (YouTube, Spotify, SoundCloud o un archivo de audio) o una ruta del
sitio que empiece por `/` (por ejemplo, `/audio/muestras/brisas-del-guatapuri.mp3`).

Además del enlace, cada opción puede tener un **archivo de audio subido** (`audio`: MP3, OGG, WAV, M4A o WebM,
máximo 10 MB) y su **texto** (`texto_audio`, letra o transcripción para quien no pueda escuchar). Se envían como
`multipart/form-data`; la respuesta devuelve la ruta del sitio (`/media/audios/…`). Enviar `audio` vacío o `null`
quita el archivo. Lo mismo aplica a `icono_imagen` de categorías y votaciones (JPG, PNG o WebP, máximo 1 MB).

### Presentación al público

`Edicion.presentacion_categorias` (`tarjetas`, `lista`, `mosaico`, `compacta`, `destacada`) define cómo se ven las
categorías, y `Votacion.presentacion_opciones` (`tarjetas`, `lista`, `mosaico`, `compacta`, `reproductor`) cómo se
ven las opciones. Ambos campos se exponen también en los endpoints públicos.

### Participación (quién votó, sin revelar por qué)

`GET /api/gestion/votaciones/{id}/participacion/` responde
`{votacion_id, votacion, estado, umbral, total_votos, total_votantes, disponible, motivo, votantes[], ocultos}`, con
`votantes = [{usuario_id, nombres, apellidos, email, fecha}]`. Para que no se pueda deducir el voto de las primeras
personas comparando la lista con los resultados en tiempo real:

- Con la votación **cerrada** se muestran todos los votantes.
- **Abierta con menos de 10 votantes**: la lista no se muestra (`disponible: false`).
- **Abierta con 10 o más**: se revelan en bloques de 10 (los primeros 10, 20, 30… en votar); el resto queda en `ocultos`.
- La lista siempre va en orden alfabético y con la fecha sin hora; nunca incluye la opción ni el comprobante.

### Integridad de los votos

`GET /api/gestion/auditoria/integridad/?edicion={id}` revisa cada votación y devuelve `ok` y `alertas` cuando: la
suma por opción no coincide con el total (`suma_por_opcion` ≠ `total_votos`), algún usuario supera el límite
(`usuarios_excedidos`), hay votos por opciones de otra votación (`votos_opcion_ajena`) o desactivadas
(`votos_inactivos`), votos fuera del periodo (`votos_fuera_de_plazo`) o comprobantes repetidos
(`comprobantes_duplicados`). Incluye un `resumen` con el total de votos, votantes únicos y votaciones con alertas.

### Datos de prueba

`python manage.py cargar_demo [--reiniciar]` carga en la base de datos ediciones, categorías, votaciones, opciones
con audio, unos 100 votantes ficticios y las cuentas `admin@festival.test` y `votante@festival.test`. Sin
`DJANGO_DEBUG` sus contraseñas se toman de `DEMO_CLAVE_ADMIN` y `DEMO_CLAVE_VOTANTE` (obligatorias).

Estado de una votación: `borrador` → (`programada`) → `abierta` → `cerrada`
(ver [diagrama de estados](../diagramas/comportamiento/estados-votacion.png)).

## Ejemplo de flujo

```bash
B=http://localhost:8096/api

# 1. Registro (devuelve el token)
curl -s -X POST $B/auth/registro/ -H "Content-Type: application/json" \
  -d '{"email":"ana@correo.test","nombres":"Ana","apellidos":"Pérez","password":"Clave-Segura-2027","acepta_tratamiento_datos":true}'

# 2. Votaciones abiertas y detalle
curl -s "$B/votaciones/?estado=abierta"
curl -s $B/votaciones/1/

# 3. Votar
curl -s -X POST $B/votaciones/1/votar/ -H "Authorization: Token <token>" \
  -H "Content-Type: application/json" -d '{"opcion": 1}'
# → 201 {"codigo_comprobante": "FLV27-6TAI30", "fecha_hora": "...", ...}

# 4. Mis votos
curl -s $B/mis-votos/ -H "Authorization: Token <token>"
```

## Diagramas

Los diagramas de la API están con los demás del proyecto en [`docs/diagramas/`](../diagramas/README.md):
[modelo físico](../diagramas/datos/modelo-fisico.png), [secuencia del voto](../diagramas/comportamiento/secuencia-voto.png),
[estados de una votación](../diagramas/comportamiento/estados-votacion.png) y
[componentes y despliegue](../diagramas/arquitectura/despliegue.png), cada uno con su fuente `.mmd`.

## Mantener esta documentación

- El esquema se genera desde el código: `python manage.py spectacular --file ../../docs/api/openapi.yaml --validate`.
- Las descripciones de cada endpoint están en los decoradores `@extend_schema` de `app/api/votaciones/views.py`.
- Si cambia un modelo, actualiza `docs/diagramas/datos/modelo-fisico.mmd` y `entidad-relacion.mmd` y regenera las imágenes.
