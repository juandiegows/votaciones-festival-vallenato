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
│   ├── diagramas/        Todos los diagramas con su fuente (casos de uso, datos, comportamiento, arquitectura)
│   ├── api/              Documentación de la API (guía y OpenAPI)
│   ├── entrega-1/        Informe PDF y capturas del prototipo
│   └── entrega-2/        Informe PDF, capturas de Django Admin y de la web con MySQL, guion del video
├── app/
│   ├── web/              Frontend (React + Vite + Bootstrap; usa la API o, sin ella, datos simulados)
│   └── api/              Backend Django REST Framework + MySQL (modelos, endpoints y pruebas)
└── .github/workflows/    GitHub Pages + imagen Docker de la web (ghcr.io)
```

## Entregas

| Entrega | Contenido | Estado |
|---|---|---|
| 1 | Análisis, requerimientos, casos de uso, modelo conceptual, prototipo navegable y panel de administración ([capturas](docs/entrega-1/capturas/)) | ✅ [Informe PDF](docs/entrega-1/Eje1_Entrega1_Votaciones_Festival_Vallenato.pdf) |
| 2 | Desarrollo inicial: proyecto Django (MVT), MySQL con adaptador, modelos y migraciones, autenticación, panel propio y Django Admin, sitio con datos reales ([capturas](docs/entrega-2/capturas/)) | ✅ [Informe PDF](docs/entrega-2/Eje2_Entrega2_Votaciones_Festival_Vallenato.pdf) · video pendiente |
| 3 – 4 | Registro definitivo de votos, reglas completas de elegibilidad, resultados, auditoría avanzada y pruebas de carga | Pendiente |

## Instalación y ejecución (Django + MySQL)

Requisitos: [Docker Desktop](https://www.docker.com/products/docker-desktop/) y Git. No hace falta instalar Python,
Node ni MySQL: cada parte corre en su contenedor.

```bash
git clone https://github.com/juandiegows/votaciones-festival-vallenato.git
cd votaciones-festival-vallenato
docker compose up -d --build                                  # MySQL 8.4 + API Django + web
docker compose exec api python manage.py cargar_demo           # datos de prueba (ediciones, categorías, votaciones, opciones)
docker compose exec api python manage.py createsuperuser       # usuario para Django Admin (pide correo y contraseña)
```

Al arrancar, la API espera a MySQL y ejecuta `migrate` sola (`app/api/entrypoint.sh`).

| Qué | URL |
|---|---|
| Sitio Django MVT: público, registro e inicio de sesión (datos de MySQL) | http://localhost:8096/ |
| Panel de administración propio (CRUD con Django) | http://localhost:8096/panel |
| Web React (cliente de la API) | http://localhost:8095 |
| Django Admin (ediciones, categorías, votaciones y opciones) | http://localhost:8096/django-admin/ |
| Documentación de la API (Swagger) | http://localhost:8096/api/docs/ |

Comprobaciones:

```bash
docker compose exec api python manage.py showmigrations votaciones   # migraciones aplicadas en MySQL
docker compose exec api python manage.py test                        # pruebas automatizadas (API + sitio MVT)
```

Para correr las pruebas contra MySQL, el usuario `votaciones` necesita permiso sobre la base de pruebas (una sola vez):

```bash
docker compose exec db mysql -uroot -p -e "GRANT ALL PRIVILEGES ON \`test_votaciones_flv\`.* TO 'votaciones'@'%';"
```

Sin Docker, la API también corre con SQLite: ver [`app/api/README.md`](app/api/README.md).

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
