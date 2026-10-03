# app/api – API REST (Django + DRF + MySQL)

Backend del Sistema Web de Votaciones del Festival de la Leyenda Vallenata. La documentación funcional de los endpoints está en
[`docs/api/README.md`](../../docs/api/README.md) y en Swagger (`/api/docs/`).

## Estructura

```
app/api/
├── config/              settings (variables de entorno), urls, wsgi
├── votaciones/
│   ├── models.py        Usuario, Edicion, Categoria, Votacion, Opcion, Voto, RegistroAuditoria
│   ├── migrations/      0001_initial · 0002_slugs_urls_amigables
│   ├── serializers.py   validación y formato JSON
│   ├── servicios.py     reglas de negocio (emitir voto, resultados, publicar, auditoría)
│   ├── views.py         endpoints públicos, de votante y de administración
│   ├── permissions.py   EsAdministrador
│   ├── urls.py          rutas /api/…
│   ├── admin.py         panel /django-admin/
│   ├── management/      comando cargar_demo (datos de demostración)
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

## Datos de demostración

```bash
python manage.py cargar_demo              # carga los datos si aún no existen (idempotente)
python manage.py cargar_demo --reiniciar  # borra los datos de demostración y los vuelve a cargar
docker exec votaciones_api_local python manage.py cargar_demo --reiniciar   # en Docker
```

Equivale a `app/web/src/data/seed.js`: ediciones 2027 (activa) y 2026 (cerrada), categorías, votaciones y
opciones **ilustrativas y ficticias** con fechas relativas (hay votaciones abiertas, programadas, cerradas y un
borrador con una sola opción), unos 100 votantes ficticios con votos y las cuentas
`admin@festival.test` / `Admin2027*` (administrador) y `votante@festival.test` / `Voto2027*`. Las opciones
musicales enlazan a las muestras instrumentales de la web (`/audio/muestras/*.mp3`). `--reiniciar` también
elimina los votos de otros usuarios en esas ediciones.

Esas contraseñas solo se usan con `DJANGO_DEBUG=true`. En un servidor público (sin DEBUG) el comando exige
`DEMO_CLAVE_ADMIN` y `DEMO_CLAVE_VOTANTE`, para que nadie entre al panel con una clave publicada en este README:

```bash
docker exec -e DEMO_CLAVE_ADMIN='<clave>' -e DEMO_CLAVE_VOTANTE='<clave>' votaciones_api python manage.py cargar_demo --reiniciar
```

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
| `DJANGO_SECRET_KEY` | clave de desarrollo | **Obligatoria con `DJANGO_DEBUG=false`**: sin ella la API no arranca |
| `DJANGO_DEBUG` | `true` | `false` en producción |
| `DJANGO_ALLOWED_HOSTS` | `localhost,127.0.0.1` | Dominios permitidos |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | — | Orígenes https de confianza para formularios (p. ej. `/django-admin/`) |
| `DJANGO_NUM_PROXIES` | `0` | Proxies delante de Django. Con `0` la IP del cliente es `REMOTE_ADDR` y se ignora `X-Forwarded-For` (no se puede falsear); producción (edge_nginx): `1` |
| `DB_ENGINE` | `sqlite` | `mysql` para usar MySQL |
| `DB_HOST` · `DB_PORT` · `DB_NAME` · `DB_USER` · `DB_PASSWORD` | — | Conexión a MySQL |
| `CORS_ALLOWED_ORIGINS` | web local, GitHub Pages y votaciones.juandiegows.com | Orígenes que pueden llamar a la API |
| `THROTTLE_LOGIN` · `THROTTLE_REGISTRO` · `THROTTLE_VOTAR` · `THROTTLE_CONFIRMACION` | `10/min` · `10/min` · `30/min` · `5/min` | Límites de uso |
| `DEMO_CLAVE_ADMIN` · `DEMO_CLAVE_VOTANTE` | claves documentadas (solo con DEBUG) | Contraseñas de las cuentas de `cargar_demo`; obligatorias sin DEBUG |
| `CORREO_ADAPTADOR` | `consola` | Proveedor de correo: `consola` (solo imprime), `smtp` o `zeptomail` |
| `CORREO_REMITENTE` · `CORREO_REMITENTE_NOMBRE` · `CORREO_RESPONDER_A` | `no-responder@votaciones.juandiegows.com` | Remitente de los correos |
| `CORREO_URL_SITIO` | `http://localhost:5195` | URL de la web usada en los enlaces de los correos |
| `CORREO_CONFIRMACION_HORAS` | `48` | Vigencia del enlace para confirmar el correo |
| `CORREO_EN_SEGUNDO_PLANO` | `true` | Entrega los correos del registro y del voto en un hilo aparte (no demora la respuesta) |
| `EMAIL_HOST` · `EMAIL_PORT` · `EMAIL_HOST_USER` · `EMAIL_HOST_PASSWORD` · `EMAIL_USE_TLS` · `EMAIL_USE_SSL` | `localhost` · `587` | Adaptador `smtp` |
| `ZEPTOMAIL_TOKEN` · `ZEPTOMAIL_API_URL` · `ZEPTOMAIL_BOUNCE_ADDRESS` | — · `https://api.zeptomail.com/v1.1/email` | Adaptador `zeptomail` (API de Zoho ZeptoMail); la URL debe ser `https://` |

Plantilla: [`.env.example`](.env.example). En desarrollo local, `settings.py` lee `app/api/.env` si existe
(las variables del sistema o de Docker tienen prioridad).

### Correo

`votaciones/correo/` envía los correos transaccionales con plantillas HTML + texto (`templates/correo/`):
bienvenida, confirmación de correo, comprobante de voto y restablecimiento de contraseña.

```python
from votaciones import correo
correo.enviar_bienvenida(usuario)
correo.enviar_confirmacion_correo(usuario, enlace)
correo.enviar_comprobante_voto(voto)
correo.enviar_restablecer_clave(usuario, enlace)
```

Se envían solos: la **confirmación de correo** al registrarse, la **bienvenida** al confirmar y el **comprobante** al votar, siempre después de que el
registro o el voto quedan guardados. Si el correo falla, el error queda en el log y la operación del usuario no se afecta.

El proveedor es un adaptador (`correo/adaptadores/`): para cambiarlo basta con `CORREO_ADAPTADOR`; para agregar
uno nuevo se crea una subclase de `AdaptadorCorreo` y se registra en `CORREO_ADAPTADORES` (`settings.py`).
