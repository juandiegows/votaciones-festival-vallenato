# Sistema Web de Votaciones – Festival de la Leyenda Vallenata 2027

Prototipo navegable (UX/UI) para la **Entrega 1 – Eje 1** del curso *Desarrollo Web* (Fundación Universitaria del Área Andina, 2026).

> **Prototipo académico · Datos simulados.** No es la plataforma oficial del Festival ni usa su marca. Las categorías, votaciones y opciones son **ilustrativas** y están pendientes de validación con la Fundación. Todos los nombres de personas, canciones y agrupaciones son ficticios.

**Demo en línea:** https://juandiegows.github.io/votaciones-festival-vallenato/

## Identidad visual

El prototipo respeta los **colores de marca del Festival** (tomados de festivalvallenato.com, revisado el 2 oct 2026): Rojo Festival `#DD3333`, Negro Tarima `#000000` y Dorado Leyenda `#D7AC70`, con secundarios, neutros y colores funcionales para accesibilidad AA. Tipografías **Raleway 800** (títulos) y **Poppins** (texto). No se usa el logo oficial.

- Paleta completa, contrastes y reglas de uso: [`docs/BRANDING.md`](../docs/BRANDING.md)
- Tokens CSS: [`src/styles/brand.css`](src/styles/brand.css)
- Guía interactiva en el prototipo: ruta `#/marca` (enlazada en el pie de página)

## Equipo

- Sebastián Bautista Martínez
- María Labarca Briceño
- Juan Mejía Maestre

## Credenciales de demostración

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@festival.test` | `Admin2027*` |
| Votante | `votante@festival.test` | `Voto2027*` |

También puedes crear una cuenta nueva en **Registro**. El botón **«Restablecer datos de demostración»** (pie de página) vuelve a cargar los datos semilla.

## Cómo ejecutar

Requiere Node.js 20.19+ (o 22).

```bash
npm install
npm run dev       # desarrollo
npm run build     # compilación a dist/
npm run preview   # sirve la compilación
```

## Tecnología

- React + Vite (JavaScript), `react-router-dom` con **HashRouter** (compatible con GitHub Pages).
- Bootstrap 5 + Bootstrap Icons. Gráficos con barras en CSS (sin librerías).
- **Sin backend:** los datos viven en `localStorage` (simulación de la base de datos).
- Despliegue automático con GitHub Actions → GitHub Pages (`.github/workflows/deploy.yml` en la raíz del repositorio).

## Estructura

```
src/
├── data/        seed.js (datos ilustrativos) · storage.js (persistencia en localStorage) · marca.js (paleta)
├── styles/      brand.css (tokens de marca + mapeo a Bootstrap)
├── context/     AppContext.jsx (estado global, autenticación y acciones ≈ futuras vistas Django)
├── components/  Navbar, Footer, Modal, Avatar SVG, EstadoBadge, Countdown, ResultadosChart, guardas de ruta…
├── pages/       pantallas públicas y de votante
│   └── admin/   pantallas del rol administrador
└── utils/       helpers (estado por fechas, CSV, validaciones, formato de fechas es-CO)
```

Cada página corresponde a una futura plantilla de Django y cada acción del contexto a una vista/endpoint, para facilitar la migración en entregas posteriores.

## Modelo de datos

`EDICIÓN → CATEGORÍA → VOTACIÓN → OPCIÓN → VOTO`, más `USUARIO`.

- **Edicion:** id, nombre, anio, fechaInicio, fechaFin, estado (activa/cerrada)
- **Categoria:** id, edicionId, nombre, descripcion, icono, activa, orden
- **Votacion:** id, categoriaId, titulo, descripcion, fechaApertura, fechaCierre, estado (programada/abierta/cerrada, calculado por fechas o cierre manual), votosPorUsuario, mostrarResultados («al cerrar» | «en tiempo real» | «no publicar»), imagen
- **Opcion:** id, votacionId, nombre, descripcion, enlaceMultimedia, orden
- **Usuario:** id, nombres, apellidos, correo, contrasena (texto plano **solo en el mock**), rol, aceptaTratamientoDatos, fechaRegistro
- **Voto:** id, usuarioId, votacionId, opcionId, fechaHora, codigoComprobante (p. ej. `FLV27-8F3K2A`)

Campos auxiliares del prototipo en Votacion: `publicada` (borrador/publicada), `cerradaManualmente`, `resultadosPublicados` (RF-15).

## Rutas (pantallas)

| Ruta | Pantalla | Requisito |
|---|---|---|
| `#/` | Inicio | — |
| `#/registro` | Registro | RF-01, RN-10 |
| `#/login` | Inicio de sesión + recuperar contraseña (simulado) | RF-02, RF-03 |
| `#/categorias` | Categorías | RF-04 |
| `#/categorias/:id` | Votaciones disponibles (filtro por estado) | RF-05 |
| `#/votaciones/:id` | Detalle de la votación + confirmación (modal) | RF-06, RF-07 |
| `#/votaciones/:id/comprobante` | Comprobante y resultados | RF-09, RN-07 |
| `#/mis-votos` | Mis votos | — |
| `#/marca` | Guía de identidad visual | — |
| `#/admin` | Panel principal (KPI + auditoría simulada) | RF-16 |
| `#/admin/ediciones` | Gestión de ediciones | RF-10 |
| `#/admin/categorias` | Gestión de categorías | RF-11 |
| `#/admin/votaciones` | Gestión de votaciones | RF-12, RN-06, RN-09 |
| `#/admin/votaciones/:id/opciones` | Gestión de opciones | RF-13 |
| `#/admin/resultados` | Resultados, exportar CSV, publicar | RF-14, RF-15 |

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
