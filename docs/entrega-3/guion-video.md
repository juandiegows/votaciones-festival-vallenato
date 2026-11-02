# Guion del video – Entrega 3

**Duración máxima: 8 minutos.** Sustenta el delegado, Juan Mejía Maestre, sobre producción (https://votaciones.juandiegows.com). Las pruebas automáticas se corren en local con Docker.

## Casos que demuestra el video

| Caso | Acción | Resultado esperado | Bloque | Cómo queda demostrado |
|---|---|---|---|---|
| CP-01 | Usuario autenticado selecciona una opción válida | Se registra un voto en MySQL | 3 y 8 | Comprobante FLV27-… y su fila en phpMyAdmin |
| CP-02 | Intenta votar otra vez en la misma categoría, por otra opción o subevento | Se rechaza el segundo voto | 4 | «Ya votaste…» en la votación, en el otro subevento y en el servidor |
| CP-03 | Vota en una categoría diferente | Se permite el voto | 5 | Segundo comprobante, en Acordeoneros |
| CP-04 | Usuario no autenticado intenta votar | Se exige autenticación | 2 y 9 | Lleva a /login; la API responde 401 |
| CP-05 | Intenta votar en categoría no habilitada | Se rechaza la operación | 5 y 9 | Votación cerrada, categoría apagada con 404 y API con 409 |
| CP-06 | Envía una opción que pertenece a otra categoría | Se rechaza la operación | 9 | API: 400 opcion_invalida |
| CP-07 | Consulta sus categorías votadas | Se muestran registros correctos | 6 | «Mis votos», con opción y comprobante |
| CP-08 | Administrador consulta los votos | Los datos coinciden con MySQL | 6 y 8 | Conteos y participantes por separado; mismos comprobantes en Django Admin y phpMyAdmin, sin mostrar al votante |
| CP-09 | Se envían dos solicitudes simultáneas a la misma categoría | Solo queda un voto válido | 8 y 9 | Restricción única, API con 201 y 409, y prueba con hilos |
| CP-10 | Se consulta GET /api/categorias/ | JSON válido con categorías y opciones reales | 7 y 9 | JSON en pantalla, código y Swagger |

## Bloque 1 · 0:00–0:45 · Presentación del proyecto y del delegado

**En pantalla:**

- Inicio del sitio: votaciones.juandiegows.com

**Decir:**

> Hola, profesor. Soy Juan Mejía Maestre, delegado del equipo Votaciones FLV, de Desarrollo Web. El equipo lo conformamos Sebastián Bautista Martínez, María Virginia Labarca Briceño y yo: somos tres integrantes, como usted lo autorizó.
>
> Esta es la Entrega 3 del Sistema Web de Votaciones del Festival de la Leyenda Vallenata 2027. Sobre el proyecto Django y MySQL de la entrega anterior construimos el módulo real de votaciones.
>
> La regla central es: un voto por usuario, por categoría y por edición. En este video demuestro, sobre la aplicación desplegada, las diez pruebas: de CP-01 a CP-10.

## Bloque 2 · 0:45–1:30 · Inicio de sesión y categorías (CP-04)

**En pantalla:**

- Ventana 1, sin sesión: clic en «Categorías y votaciones».
- Parrandas → «Mejor parranda vallenata». Elegir la primera opción → «Votar».
- Aparece el inicio de sesión. Ingresar con tu cuenta, sin decir la clave.

**Decir:**

> Estas son las categorías de la edición 2027. No están escritas en el código: Django las consulta en MySQL según la edición activa.
>
> Entro a Parrandas, elijo una opción y pulso Votar sin haber iniciado sesión. El sistema no registra nada y me envía a iniciar sesión. Esta es la prueba CP-04: se exige autenticación.
>
> Inicio sesión con mi cuenta, y el sistema me devuelve a la votación con la opción que había elegido.

## Bloque 3 · 1:30–2:30 · Voto válido (CP-01)

**En pantalla:**

- Con la opción marcada: «Votar».
- Cuadro «Confirma tu voto»: señalar la opción y el aviso → «Confirmar voto».
- Comprobante: señalar el código FLV27-… y anotarlo.

**Decir:**

> Ya con sesión, mi opción sigue seleccionada. Pulso Votar.
>
> Antes de guardar, el sistema pide confirmar: muestra la opción elegida y advierte que el voto no se puede cambiar. Confirmo.
>
> El formulario se envía por POST con el token CSRF de Django. El servidor valida las reglas y guarda el voto en MySQL.
>
> Este es mi comprobante, con su código único. Esta es la prueba CP-01: un usuario autenticado vota por una opción válida y el voto queda registrado. Más adelante voy a mostrar este mismo código en la base de datos.

## Bloque 4 · 2:30–3:30 · Segundo voto en la misma categoría (CP-02)

**En pantalla:**

- Volver a «Mejor parranda vallenata»: «Ya votaste en esta votación», sin botón.
- Abrir «Mejor anfitrión de parranda»: «Ya votaste en la categoría «Parrandas»».
- Ventana 2 (incógnito), abierta antes de votar en «Mejor anfitrión»: elegir opción → «Votar» → «Confirmar voto».
- Señalar el mensaje: «Solo se permite un voto por categoría en cada edición».

**Decir:**

> Ahora intento votar dos veces en la misma categoría. Si vuelvo a la misma votación, el sistema dice que ya voté y quita el botón.
>
> Parrandas tiene otro subevento: Mejor anfitrión de parranda. Es otra votación, pero la misma categoría, así que también dice que ya voté.
>
> Pero el botón no es la protección. Esta otra ventana la abrí antes de votar y todavía tiene el formulario. Elijo una opción, confirmo… y Django lo rechaza en el servidor. Sigue habiendo un solo voto. Esta es la prueba CP-02.

## Bloque 5 · 3:30–4:15 · Voto en otra categoría (CP-03, CP-05)

**En pantalla:**

- Ventana 1: Acordeoneros → «Acordeonero favorito del público». Votar y confirmar: comprobante.
- Ventana 3 (admin), /panel/categorias: check «Un solo voto en toda la categoría».
- Ventana 1: Música → «Canción inédita revelación»: «Esta votación cerró…», botón deshabilitado.

**Decir:**

> La regla no impide participar en otras categorías. Voy a Acordeoneros, voto, y el sistema lo permite. Esta es la prueba CP-03.
>
> En el panel, cada categoría tiene este check, marcado por defecto. Si se desmarca, se vota una vez en cada votación de esa categoría; y con votos registrados, se bloquea.
>
> Esta otra votación está cerrada, así que no recibe votos. Es la primera parte de la prueba CP-05; al final la completo.

## Bloque 6 · 4:15–5:00 · Historial y administración (CP-07, CP-08)

**En pantalla:**

- Ventana 1: menú «Mis votos». Señalar Parrandas y Acordeoneros.
- Ventana 3 (admin): «Votos y resultados» → «Mejor parranda vallenata» → «Ver detalle». Señalar los votos por opción y la lista de participantes.
- Ventana 3: Django Admin → Votos. Buscar tu código FLV27-… → «Buscar». Señalar la opción y que no aparece el votante.

**Decir:**

> En Mis votos consulto mi participación: las categorías donde voté, la opción y el comprobante. Esta es la prueba CP-07.
>
> Como administrador, en Votos y resultados veo cuántos votos tiene cada opción y quién participó, por separado. El voto es secreto: nadie puede ver quién votó por quién, y con pocos votantes la lista se oculta. Ese mínimo se configura en el administrador.
>
> En Django Admin busco mi comprobante y aparece con su opción, sin datos del votante. Es de solo lectura. Esta es la prueba CP-08; enseguida la comparo con MySQL.

## Bloque 7 · 5:00–6:00 · API GET y Swagger (CP-10)

**En pantalla:**

- votaciones.juandiegows.com/api/categorias/: señalar 200 y application/json. Bajar por una categoría.
- VS Code: votacion/views.py, línea 100 (CategoriaPublicaViewSet).
- VS Code: votacion/serializers.py, línea 176 (CategoriaConOpcionesSerializer).
- votaciones.juandiegows.com/api/docs/: módulos; en «Votación», desplegar POST votar y sus respuestas.

**Decir:**

> Esta es la API obligatoria: GET barra api barra categorías. Responde 200 con JSON válido.
>
> Cada categoría trae su edición, si es de voto único y sus votaciones; y cada votación trae sus opciones. Todo sale de MySQL. Esta es la prueba CP-10.
>
> En el código, la vista es CategoriaPublicaViewSet, hecha con Django REST Framework, y este serializador arma la respuesta.
>
> Toda la API está documentada en Swagger, organizada por módulos, con ejemplos y códigos de error, y se puede probar sin instalar nada.

## Bloque 8 · 6:00–7:00 · MySQL y código (CP-01, CP-08, CP-09)

**En pantalla:**

- phpMyAdmin, votaciones_flv → SQL: consulta de los últimos votos → «Continuar». Señalar tus códigos.
- Consulta de la restricción (NON_UNIQUE = 0) y consulta de migraciones.
- VS Code: votacion/models.py, línea 225 (Voto) y línea 247 (UniqueConstraint).
- votacion/servicios.py, línea 24 (emitir_voto) y línea 79 (except IntegrityError).
- portal/templates/portal/votacion.html, línea 81 (csrf_token); portal/vistas/votos.py, línea 37 (require_POST).

**Decir:**

> Esta es la base MySQL de producción. Aquí están los últimos votos, con los mismos comprobantes del sitio y del administrador: los datos coinciden y persisten. Eso confirma las pruebas CP-01 y CP-08. Las migraciones 0004 y 0005 están aplicadas, y esta es la restricción única.
>
> En el código, el modelo Voto une al usuario con la edición, la categoría, la votación y la opción, sobre los modelos de la Entrega 2.
>
> emitir_voto valida la categoría, la votación, la opción y el voto previo. Si dos solicitudes llegan a la vez, MySQL rechaza la segunda y Django responde que ya voté. Esa es la prueba CP-09.
>
> Además, el voto solo se acepta por POST y con token CSRF.

## Bloque 9 · 7:00–8:00 · Pruebas adicionales y cierre (CP-04, CP-05, CP-06, CP-09, CP-10)

**En pantalla:**

- Ventana 3, /panel/categorias: apagar Piloneras. Ventana 1: abrir su votación → 404. Volver a encender Piloneras.
- Terminal 2: comando de Newman. Señalar CP-04, CP-05, CP-06 y CP-09 con √.
- Terminal 2: comando de pruebas. Señalar test_cp01 a test_cp10, Ran 15 tests, OK.
- Detener la grabación.

**Decir:**

> Si la administración deshabilita una categoría, deja de existir para el público y no recibe votos: así completo la prueba CP-05. La vuelvo a activar.
>
> Ahora me salto la interfaz y llamo la API de producción directamente. Sin token responde 401. En una votación cerrada, 409. Con una opción de otra categoría, 400: esa es la prueba CP-06. Y con dos votos simultáneos, uno se acepta y el otro se rechaza: solo queda uno.
>
> Además, las pruebas automáticas contra MySQL, de CP-01 a CP-10, pasan todas.
>
> En conclusión, el voto es real, verificable y está protegido en Django y en MySQL. Para la Entrega 4 quedan las pruebas integrales, las correcciones y la presentación final. Muchas gracias, profesor.
