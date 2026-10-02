# Documentación de la API

API REST del Sistema Web de Votaciones del Festival de la Leyenda Vallenata 2027, construida con
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
- **Roles:** `votante` (por defecto al registrarse) y `administrador`. Las rutas `/api/admin/…` exigen
  administrador; un votante recibe `403`.
- **Límites de uso (throttling):** login y registro 10/min; votar 30/min por usuario.

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
| POST | `/api/auth/registro/` | Público | Registra un votante; exige `acepta_tratamiento_datos=true` (RF-01, RN-10) |
| POST | `/api/auth/login/` | Público | Devuelve `token` y datos del usuario (RF-02) |
| POST | `/api/auth/logout/` | Token | Invalida el token |
| GET | `/api/auth/yo/` | Token | Usuario autenticado |

### Consulta pública

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/ediciones/` · `/api/ediciones/{id}/` | Ediciones del Festival |
| GET | `/api/ediciones/vigente/` | Edición activa más reciente |
| GET | `/api/categorias/?edicion={id}` | Categorías activas; sin parámetro, las de la edición activa (RF-04) |
| GET | `/api/votaciones/?categoria={id}&estado={programada\|abierta\|cerrada}` | Votaciones publicadas (RF-05) |
| GET | `/api/votaciones/{id}/` | Detalle con opciones activas y `mis_votos` del usuario (RF-06) |
| GET | `/api/votaciones/{id}/resultados/` | Resultados si la visibilidad lo permite (RF-15, RN-07) |

### Votación

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/api/votaciones/{id}/votar/` | Token | Emite un voto `{ "opcion": <id> }` y devuelve el comprobante (RF-07, RF-08) |
| GET | `/api/mis-votos/` | Token | Votos y comprobantes del usuario (RF-09) |

### Administración (rol administrador)

| Método | Ruta | Descripción |
|---|---|---|
| CRUD | `/api/admin/ediciones/` | Gestión de ediciones (RF-10) |
| CRUD | `/api/admin/categorias/?edicion={id}` | Gestión de categorías (RF-11) |
| CRUD | `/api/admin/votaciones/?categoria={id}` | Gestión de votaciones (RF-12); se crean como **borrador** |
| POST | `/api/admin/votaciones/{id}/publicar/` | Publica si hay al menos dos opciones activas (RN-06) |
| POST | `/api/admin/votaciones/{id}/cerrar/` | Cierre anticipado |
| POST | `/api/admin/votaciones/{id}/publicar-resultados/` | `{ "publicar": true\|false }` (RF-15) |
| GET | `/api/admin/votaciones/{id}/resultados/` | Resultados completos, siempre visibles para el administrador (RF-14) |
| GET | `/api/admin/votaciones/{id}/resultados/csv/` | Exporta los resultados en CSV (RF-14) |
| CRUD | `/api/admin/opciones/?votacion={id}` | Gestión de opciones (RF-13) |
| GET | `/api/admin/auditoria/` | Registro de auditoría paginado, 50 por página (RF-16, RN-12) |

`CRUD` = `GET` lista, `POST` crear, `GET/PUT/PATCH/DELETE` sobre `{id}/`. Eliminar una votación u opción con
votos responde `409` (RN-09); eliminar una edición o categoría con elementos asociados también responde `409`.
Toda creación, modificación, eliminación, publicación, cierre y exportación queda en la auditoría.

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

Estado de una votación: `borrador` → (`programada`) → `abierta` → `cerrada`
(ver [diagrama de estados](diagramas/04-estados-votacion.png)).

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

| Diagrama | Archivo | Fuente Mermaid |
|---|---|---|
| Modelo de datos físico | [`01-modelo-datos.png`](diagramas/01-modelo-datos.png) | [`.mmd`](diagramas/01-modelo-datos.mmd) |
| Secuencia: emitir voto | [`02-secuencia-emitir-voto.png`](diagramas/02-secuencia-emitir-voto.png) | [`.mmd`](diagramas/02-secuencia-emitir-voto.mmd) |
| Componentes y despliegue (propuesta) | [`03-componentes-despliegue.png`](diagramas/03-componentes-despliegue.png) | [`.mmd`](diagramas/03-componentes-despliegue.mmd) |
| Estados de una votación | [`04-estados-votacion.png`](diagramas/04-estados-votacion.png) | [`.mmd`](diagramas/04-estados-votacion.mmd) |

El diagrama de despliegue muestra la arquitectura objetivo. Hoy en la VPS solo está publicada la web; la API
se publicará en una entrega posterior.

## Mantener esta documentación

- El esquema se genera desde el código: `python manage.py spectacular --file ../../docs/api/openapi.yaml --validate`.
- Las descripciones de cada endpoint están en los decoradores `@extend_schema` de `app/api/votaciones/views.py`.
- Si cambia un modelo, actualiza `diagramas/01-modelo-datos.mmd` y regenera la imagen.
