# Sistema Web de Votaciones – Festival de la Leyenda Vallenata 2027

Proyecto de la asignatura **Desarrollo Web (4324 – 61)** · Fundación Universitaria del Área Andina · 2026.
Profesor: Deivys Morales Uribe.

Plataforma web configurable para gestionar votaciones del público del Festival de la Leyenda Vallenata,
organizada bajo la jerarquía **Edición → Categoría → Votación → Opción → Voto**.

> Proyecto académico. No es la plataforma oficial del Festival; los datos del prototipo son ficticios.

## Equipo

| Integrante | Rol | GitHub |
|---|---|---|
| Juan Mejía Maestre | Coordinación y diseño UX/UI | [@juandiegows](https://github.com/juandiegows) |
| Sebastián Bautista Martínez | Análisis y modelado | [@sbautista15](https://github.com/sbautista15) |
| María Labarca Briceño | Investigación y documentación | [@mlabarca-jpg](https://github.com/mlabarca-jpg) |

## Estructura del monorepositorio

```
votaciones-festival-vallenato/
├── docs/                 Documentación del proyecto
│   ├── BRANDING.md       Identidad visual (paleta, tipografías, reglas de uso)
│   ├── api/              Documentación de la API (guía, OpenAPI y diagramas)
│   └── entrega-1/        Informe PDF, diagramas y capturas del prototipo
├── app/
│   ├── web/              Frontend (React + Vite + Bootstrap; en la Entrega 1 con datos simulados)
│   └── api/              Backend Django REST Framework + MySQL (modelos, endpoints y pruebas)
└── .github/workflows/    GitHub Pages + imagen Docker de la web (ghcr.io)
```

## Entregas

| Entrega | Contenido | Estado |
|---|---|---|
| 1 | Análisis, requerimientos, casos de uso, modelo conceptual y prototipo navegable | ✅ [Informe PDF](docs/entrega-1/Eje1_Entrega1_Votaciones_Festival_Vallenato.pdf) |
| 2 – 4 | Desarrollo con Django (MVT) y MySQL | Pendiente |

## Web

- **Producción (VPS):** https://votaciones.juandiegows.com
- **GitHub Pages:** https://juandiegows.github.io/votaciones-festival-vallenato/
- Instrucciones, rutas y credenciales de prueba: [`app/web/README.md`](app/web/README.md)

```bash
cd app/web
npm install
npm run dev
```

## Docker (entorno local)

Requiere Docker Desktop. Desde la raíz del repositorio:

```bash
docker compose up -d --build          # web compilada con nginx  → http://localhost:8095
docker compose --profile dev up -d    # + modo desarrollo (Vite, recarga en caliente) → http://localhost:5195
docker compose --profile dev down     # detener todo
```

| Servicio | Contenedor | URL | Uso |
|---|---|---|---|
| `web` | `votaciones_web_local` | http://localhost:8095 | Misma imagen que producción (nginx) |
| `web-dev` | `votaciones_web_dev` | http://localhost:5195 | Desarrollo: los cambios en `app/web/src` se ven al instante |
| `api` | `votaciones_api_local` | http://localhost:8096/api/ · [Swagger](http://localhost:8096/api/docs/) | API Django REST |
| `db` | `votaciones_db_local` | `127.0.0.1:3317` | MySQL 8.4 (usuario `votaciones`) |

## API

- Guía de endpoints, autenticación, errores y reglas de negocio: [`docs/api/README.md`](docs/api/README.md)
- Ejecución, pruebas y variables de entorno: [`app/api/README.md`](app/api/README.md)

## Arquitectura

Arquitectura **desacoplada**: el frontend React consume una API REST construida con Django.

| Capa | Tecnología |
|---|---|
| Frontend (`app/web`) | React + Vite, Bootstrap 5, HTML5, CSS3, JavaScript |
| Backend (`app/api`) | Python + Django + Django REST Framework (modelos y reglas de negocio) |
| Base de datos | MySQL |
| Despliegue | Imagen Docker (nginx) en VPS detrás de Cloudflare · GitHub Pages para la demo |
| Integración | Enlace desde el sitio oficial del Festival (subdominio institucional pendiente de validación) |
