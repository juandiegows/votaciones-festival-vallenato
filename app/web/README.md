# Sistema Web de Votaciones – Festival de la Leyenda Vallenata 2027

Prototipo navegable (UX/UI) para la **Entrega 1 – Eje 1** del curso *Desarrollo Web* (Fundación Universitaria del Área Andina, 2026).

> **Prototipo académico · Datos simulados.** No es la plataforma oficial del Festival ni usa su marca. Las categorías, votaciones y opciones son **ilustrativas** y están pendientes de validación con la Fundación. Todos los nombres de personas, canciones y agrupaciones son ficticios.

**Demo en línea:** https://juandiegows.github.io/votaciones-festival-vallenato/

## Identidad visual

El prototipo respeta los **colores de marca del Festival** (tomados de festivalvallenato.com, revisado el 2 oct 2026): Rojo Festival `#DD3333`, Negro Tarima `#000000` y Dorado Leyenda `#D7AC70`, con secundarios, neutros y colores funcionales para accesibilidad AA. Tipografías **Raleway 800** (títulos) y **Poppins** (texto). No se usa el logo oficial.

- Paleta completa, contrastes y reglas de uso: [`docs/BRANDING.md`](../../docs/BRANDING.md)
- Tokens CSS: [`src/styles/brand.css`](src/styles/brand.css)
- Guía interactiva en el prototipo: ruta `/panel/marca` (solo para el administrador)

## Equipo

- Sebastián Bautista Martínez
- María Labarca Briceño
- Juan Mejía Maestre

## Credenciales de demostración

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@festival.test` | `Admin2027*` |
| Votante | `votante@festival.test` | `Voto2027*` |

También puedes crear una cuenta nueva en **Registro**. En el modo de demostración, el botón **«Restablecer datos de demostración»** (pie de página) vuelve a cargar los datos semilla; en el modo API los datos se restauran en el servidor con `python manage.py cargar_demo --reiniciar`.

## Modos de datos

La web funciona con dos fuentes de datos. El modo se elige **al compilar** con la variable `VITE_API_URL`:

| Modo | `VITE_API_URL` | Datos | Uso |
|---|---|---|---|
| Demostración | sin definir | Simulados en `localStorage` (`src/data/seed.js`) | GitHub Pages, prototipo sin servidor |
| API | p. ej. `/api` (mismo dominio) o `http://localhost:8096/api` | API REST de Django (`app/api`) | VPS, Docker local |

```bash
npm run build                                          # modo demostración
VITE_API_URL=http://localhost:8096/api npm run dev     # modo API en desarrollo (Windows PowerShell: $env:VITE_API_URL="…"; npm run dev)
VITE_BASE=/ VITE_API_URL=/api npm run build            # modo API servido en la raíz del dominio
```

- La capa de datos está en `src/context/`: `MockProvider.jsx` (demostración) y `ApiProvider.jsx` (API) exponen
  **el mismo contexto** (`useApp()`), así que las pantallas no dependen del modo. Todas las acciones son
  asíncronas y devuelven `{ ok, error }`; las pantallas muestran el estado «Guardando…» y el mensaje de error del
  servidor (`detail`).
- `src/api/cliente.js`: `fetch` con el token en `localStorage` (`Authorization: Token …`); `src/api/adaptadores.js`:
  única traducción entre los campos de la API (snake_case) y los de la web (camelCase).
- En el modo API la sesión se restaura al cargar (`/auth/yo/`), el cierre de sesión invalida el token
  (`/auth/logout/`), los resultados públicos respetan la visibilidad del servidor y el CSV se descarga desde la API.
- Si la web se sirve en otro origen que la API, ese origen debe estar en `CORS_ALLOWED_ORIGINS` de la API.

## Cómo ejecutar

Requiere Node.js 20.19+ (o 22).

```bash
npm install
npm run dev       # desarrollo
npm run build     # compilación a dist/
npm run preview   # sirve la compilación
```

## Tecnología

- React + Vite (JavaScript), `react-router-dom` con **BrowserRouter**: URL limpias, sin `#`. Para GitHub Pages, `npm run build`
  copia `dist/index.html` a `dist/404.html` (script `postbuild`) para atender los enlaces profundos; en la VPS/Docker
  nginx responde `index.html` a cualquier ruta. La web nunca usa las rutas `/api`, `/django-admin` ni `/static`.
- Bootstrap 5 + Bootstrap Icons. Gráficos con barras en CSS (sin librerías).
- Datos en `localStorage` (modo demostración) o en la API de Django (modo API); ver «Modos de datos».
- Muestras de audio instrumentales **originales** generadas para el proyecto en `public/audio/muestras/` (ilustrativas).
- Despliegue automático con GitHub Actions → GitHub Pages (`.github/workflows/deploy.yml` en la raíz del repositorio).

## Estructura

```
src/
├── api/         cliente.js (fetch + token) · adaptadores.js (snake_case ↔ camelCase)
├── data/        seed.js (datos ilustrativos) · storage.js (persistencia en localStorage) · marca.js (paleta) · credencialesDemo.js
├── styles/      brand.css (tokens de marca + mapeo a Bootstrap)
├── context/     AppContext.jsx (elige el proveedor) · MockProvider.jsx · ApiProvider.jsx · contexto.js (contrato común)
├── hooks/       useResultados (resultados con visibilidad) · useRutas (URL amigables por edición)
├── components/  Navbar, Footer, Modal, Avatar SVG, EstadoBadge, Countdown, ResultadosChart, ReproductorMultimedia, guardas de ruta…
├── pages/       pantallas públicas y de votante
│   └── admin/   pantallas del rol administrador
└── utils/       helpers (estado por fechas, CSV, validaciones, formato de fechas es-CO)
```

Cada página corresponde a una futura plantilla de Django y cada acción del contexto a una vista/endpoint, para facilitar la migración en entregas posteriores.

## Modelo de datos

`EDICIÓN → CATEGORÍA → VOTACIÓN → OPCIÓN → VOTO`, más `USUARIO`.

- **Edicion:** id, nombre, anio, fechaInicio, fechaFin, estado (activa/cerrada)
- **Categoria:** id, edicionId, nombre, slug, descripcion, icono, activa, orden
- **Votacion:** id, categoriaId, titulo, slug, descripcion, fechaApertura, fechaCierre, estado (programada/abierta/cerrada, calculado por fechas o cierre manual), votosPorUsuario, mostrarResultados («al cerrar» | «en tiempo real» | «no publicar»), imagen
- **Opcion:** id, votacionId, nombre, descripcion, enlaceMultimedia (URL http(s), ruta del sitio como `/audio/muestras/x.mp3`, YouTube, Spotify o SoundCloud), orden
- **Usuario:** id, nombres, apellidos, correo, contrasena (texto plano **solo en el mock**), rol, aceptaTratamientoDatos, fechaRegistro
- **Voto:** id, usuarioId, votacionId, opcionId, fechaHora, codigoComprobante (`FLV` + dos últimos dígitos del año de la edición, p. ej. `FLV27-8F3K2A`)

Campos auxiliares del prototipo en Votacion: `publicada` (borrador/publicada), `cerradaManualmente`, `resultadosPublicados` (RF-15).

## Rutas (pantallas)

URL amigables sin `#` ni IDs; el año identifica la edición, así que sirven para 2027 y para las ediciones futuras.

| Ruta | Pantalla | Requisito |
|---|---|---|
| `/` | Inicio de la edición activa | — |
| `/registro` | Registro | RF-01, RN-10 |
| `/login` | Inicio de sesión + recuperar contraseña (simulado) | RF-02, RF-03 |
| `/{año}` (p. ej. `/2027`) | Categorías de la edición | RF-04 |
| `/{año}/categorias/{categoría}` (p. ej. `/2027/categorias/musica`) | Votaciones de la categoría: programadas, abiertas y cerradas hasta N días después del cierre (N en `/panel/sitio`) | RF-05 |
| `/{año}/categorias/{categoría}/{votación}` (p. ej. `/2027/categorias/musica/cancion-favorita-del-publico`) | Detalle, muestras multimedia y confirmación del voto | RF-06, RF-07 |
| `/{año}/categorias/{categoría}/{votación}/comprobante` | Comprobante y resultados | RF-09, RN-07 |
| `/categorias` | Redirige a `/{año de la edición activa}` | — |
| `/mis-votos` | Mis votos | — |
| `/panel` | Panel principal (KPI + actividad reciente) | RF-16 |
| `/panel/ediciones` | Gestión de ediciones | RF-10 |
| `/panel/categorias` | Gestión de categorías | RF-11 |
| `/panel/votaciones` | Gestión de votaciones | RF-12, RN-06, RN-09 |
| `/panel/votaciones/:id/opciones` | Gestión de opciones | RF-13 |
| `/panel/resultados` | Resultados, exportar CSV, publicar | RF-14, RF-15 |
| `/panel/auditoria` | Registro de auditoría (50 por página) | RF-16, RN-12 |
| `/panel/banner` | Banner de inicio: imágenes del carrusel, textos, orden y estado | — |
| `/panel/sitio` | Contacto y redes sociales del pie de página | — |
| `/panel/marca` | Guía de identidad visual (solo administrador; `/marca` redirige aquí) | — |

Las rutas anteriores con ID (`/categorias/:id`, `/votaciones/:id`, `/votaciones/:id/comprobante`) redirigen a la URL
amigable. En GitHub Pages todas las rutas llevan el prefijo `/votaciones-festival-vallenato/`.

## Reglas de negocio aplicadas en la interfaz

- **RN-01** Toda votación pertenece a una categoría y toda categoría a una edición.
- **RN-02** Solo usuarios autenticados votan; el visitante que pulsa «Votar» va al login y regresa.
- **RN-03** Solo se vota entre apertura y cierre (botón deshabilitado y mensaje en otro caso).
- **RN-04** Un voto por usuario por votación (`votosPorUsuario` configurable, pendiente de validación).
- **RN-05** El voto confirmado no se puede cambiar.
- **RN-06** Una votación necesita al menos 2 opciones para publicarse.
- **RN-07** La visibilidad de resultados sigue `mostrarResultados`.
- **RN-09** Una votación con votos no se elimina, solo se cierra.
- **RN-10** El registro exige aceptar la política de tratamiento de datos (Ley 1581 de 2012).
