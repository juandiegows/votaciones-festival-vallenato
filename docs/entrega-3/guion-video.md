# Guion del video – Entrega 3

**Duración máxima: 8 minutos** (un solo video por equipo). La sustentación la puede hacer un delegado o los tres;
abajo se propone un responsable por bloque. Quien hable dice su nombre al empezar su bloque. Grabar con Docker
local (`docker compose up -d --build`) y los datos de `cargar_demo --reiniciar`.

Al terminar, anotar los **minutos reales** de cada bloque en la ficha de acceso del PDF (columna «Minuto real»).

## Antes de grabar

- `docker compose exec api python manage.py migrate` y `docker compose exec api python manage.py cargar_demo --reiniciar`.
- Tener abiertas estas pestañas (zoom del navegador al 125 % para que se lea):
  1. `http://localhost:8096/` (sitio Django, sin sesión)
  2. Ventana privada con `http://localhost:8096/2027/categorias/parrandas/mejor-anfitrion-de-parranda`
     ya con la sesión del votante (para el bloque 4, «dos pestañas»)
  3. `http://localhost:8096/api/categorias/`
  4. `http://localhost:8096/django-admin/votaciones/voto/`
  5. VS Code con `models.py`, `servicios.py`, `views.py`, `serializers.py` y `test_entrega3.py`
  6. Terminal con MySQL: `docker compose exec db mysql -uvotaciones -p votaciones_flv`
- No mostrar contraseñas, tokens ni el archivo `.env`. Las cuentas de demostración se pueden decir en voz alta
  (son ficticias): votante `votante@festival.test`, administrador `admin@festival.test`.
- Cerrar notificaciones personales. Subir a YouTube como «No listado» y probar el enlace en ventana privada.

## Bloques

| # | Tiempo | Demostración | Responsable | Qué mostrar y decir | Caso |
|---|---|---|---|---|---|
| 1 | 0:00–0:45 | Presentación del proyecto y del delegado | Juan | Equipo (tres integrantes, autorizado por el docente), proyecto Votaciones FLV 2027 y objetivo de la Entrega 3: módulo real de votaciones sobre Django + MySQL de la Entrega 2. Regla central: **un voto por usuario, categoría y edición**. | — |
| 2 | 0:45–1:30 | Inicio de sesión y categorías | María | Abrir `/categorias` sin sesión: categorías y votaciones salen de MySQL (edición 2027). Intentar votar sin sesión → el sistema pide iniciar sesión y guarda la opción elegida. Iniciar sesión como `votante@festival.test`. | CP-04 |
| 3 | 1:30–2:30 | Voto válido | María | Entrar a **Parrandas → Mejor parranda vallenata**, elegir una opción, pulsar **Votar**, mostrar el cuadro de **confirmación** y confirmar. Mostrar el comprobante (código FLV27-…). | CP-01 |
| 4 | 2:30–3:30 | Segundo voto en la misma categoría | Sebastián | 1) Volver a la misma votación: aparece «Ya votaste en esta votación» y no hay botón. 2) Abrir el otro subevento **Mejor anfitrión de parranda**: aparece «Ya votaste en la categoría Parrandas». 3) En la pestaña privada que estaba abierta **antes** de votar, elegir una opción y votar: Django rechaza con «Solo se permite un voto por categoría en cada edición». | CP-02 |
| 5 | 3:30–4:15 | Voto en otra categoría | Sebastián | Ir a **Acordeoneros → Acordeonero favorito del público** y votar: se permite. Mostrar en `/panel/categorias` el check **«Un solo voto en toda la categoría»**: marcado en Parrandas, desmarcado en Acordeoneros (por eso ahí también se puede votar en «Acordeonero juvenil favorito»), y que se bloquea cuando la categoría ya tiene votos. Mencionar que «Personaje del Festival» está cerrada y no deja votar. | CP-03, CP-05 |
| 6 | 4:15–5:00 | Historial y administración | Juan | **Mis votos**: aparecen Acordeoneros y Parrandas con su opción y comprobante. Cerrar sesión, entrar como administrador a **Django Admin → Votos**, filtrar por edición/categoría y buscar el correo del votante: coinciden los mismos comprobantes. | CP-07, CP-08 |
| 7 | 5:00–6:00 | API GET | Juan | Abrir `http://localhost:8096/api/categorias/` (o Postman): JSON válido con cada categoría, sus votaciones y sus opciones. Mostrar el código: `CategoriaPublicaViewSet` en `votacion/views.py` y `CategoriaConOpcionesSerializer` en `serializers.py`. | CP-10 |
| 8 | 6:00–7:00 | MySQL y código | Sebastián | En MySQL: `SELECT codigo_comprobante, edicion_id, categoria_id, votacion_id, opcion_id FROM voto WHERE usuario_id = (SELECT id FROM usuario WHERE email='votante@festival.test');` y `SHOW INDEX FROM voto WHERE Key_name='voto_unico_usuario_categoria_edicion';`. En código: `UniqueConstraint` del modelo `Voto` (`models.py`), migración `0004`, y en `servicios.py` → `emitir_voto` las validaciones y el `except IntegrityError`. Mostrar `{% csrf_token %}` en `votacion.html` y `@require_POST` en `vistas/votos.py`. | CP-09 |
| 9 | 7:00–8:00 | Pruebas adicionales y cierre | Los tres | 1) Saltarse el botón: en Postman, `POST http://localhost:8096/api/votaciones/{id de «Personaje del Festival»}/votar/` con el token del votante y `{"opcion": …}` → `409 votacion_no_abierta`; sin token → `401`. 2) `docker compose exec api python manage.py test portal.tests.test_entrega3 -v 2`: CP-01 a CP-10 OK, incluido CP-09 con dos hilos simultáneos contra MySQL (solo queda un voto). Cierre: una frase por persona sobre lo logrado y lo pendiente para la Entrega 4. | CP-05, CP-06, CP-09 |

## Texto sugerido (resumen técnico para el PDF)

> «En esta entrega el voto pasa a ser real: el modelo `Voto` vincula usuario, edición, categoría, votación y opción.
> Django valida en el servidor que la categoría esté habilitada, que la votación esté abierta, que la opción
> pertenezca a esa votación y que el usuario no haya votado ya en la categoría. Además MySQL tiene una restricción
> única por usuario, categoría y edición: si dos solicitudes llegan al mismo tiempo, la segunda falla por
> integridad y el sistema responde «Ya votaste». La API `GET /api/categorias/` devuelve en JSON las categorías con
> sus votaciones y opciones consultadas en MySQL.»

## Lista rápida al terminar

- [ ] Video ≤ 8:00, audio claro y pantalla legible.
- [ ] No mostrar el token completo en Postman (taparlo o generarlo y borrarlo después).
- [ ] Enlace de YouTube «No listado» probado en ventana privada.
- [ ] Minutos reales anotados en la ficha de acceso del PDF.
