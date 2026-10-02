# app/api – API REST (Django + DRF + MySQL)

Backend del Sistema Web de Votaciones FLV 2027. La documentación funcional de los endpoints está en
[`docs/api/README.md`](../../docs/api/README.md) y en Swagger (`/api/docs/`).

## Estructura

```
app/api/
├── config/              settings (variables de entorno), urls, wsgi
├── votaciones/
│   ├── models.py        Usuario, Edicion, Categoria, Votacion, Opcion, Voto, RegistroAuditoria
│   ├── migrations/      0001_initial
│   ├── serializers.py   validación y formato JSON
│   ├── servicios.py     reglas de negocio (emitir voto, resultados, publicar, auditoría)
│   ├── views.py         endpoints públicos, de votante y de administración
│   ├── permissions.py   EsAdministrador
│   ├── urls.py          rutas /api/…
│   ├── admin.py         panel /django-admin/
│   └── tests/           pruebas automatizadas
├── Dockerfile · entrypoint.sh (espera MySQL, migra y arranca gunicorn)
└── requirements.txt
```

## Ejecutar con Docker (recomendado)

Desde la raíz del repositorio:

```bash
docker compose up -d --build db api
docker exec -it votaciones_api_local python manage.py createsuperuser
```

API en http://localhost:8096/api/ · Swagger en http://localhost:8096/api/docs/ · panel en http://localhost:8096/django-admin/.

## Ejecutar sin Docker (SQLite)

```bash
cd app/api
python -m venv .venv
.venv\Scripts\activate          # Windows  (Linux/macOS: source .venv/bin/activate)
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver 8096
```

## Pruebas

```bash
python manage.py test votaciones          # SQLite local
```

En GitHub Actions corren contra MySQL 8.4 (`.github/workflows/api-tests.yml`) en cada cambio de `app/api/**`.

## Variables de entorno

| Variable | Valor por defecto | Descripción |
|---|---|---|
| `DJANGO_SECRET_KEY` | clave de desarrollo | **Obligatoria en producción** |
| `DJANGO_DEBUG` | `true` | `false` en producción |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | Dominios permitidos |
| `DB_ENGINE` | `sqlite` | `mysql` para usar MySQL |
| `DB_HOST` · `DB_PORT` · `DB_NAME` · `DB_USER` · `DB_PASSWORD` | — | Conexión a MySQL |
| `CORS_ALLOWED_ORIGINS` | web local, GitHub Pages y votaciones.juandiegows.com | Orígenes que pueden llamar a la API |
| `THROTTLE_LOGIN` · `THROTTLE_REGISTRO` · `THROTTLE_VOTAR` | `10/min` · `10/min` · `30/min` | Límites de uso |

Plantilla: [`.env.example`](.env.example).
