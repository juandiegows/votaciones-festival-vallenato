import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def env_bool(name, default=False):
    return os.getenv(name, str(default)).lower() in ("1", "true", "yes", "si")


def env_list(name, default=""):
    return [v.strip() for v in os.getenv(name, default).split(",") if v.strip()]


SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-insecure-cambiar-en-produccion")
DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",
    "drf_spectacular",
    "votaciones",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# Base de datos: MySQL en Docker/VPS (DB_ENGINE=mysql); SQLite para desarrollo rápido y pruebas.
if os.getenv("DB_ENGINE", "sqlite") == "mysql":
    import pymysql

    pymysql.install_as_MySQLdb()
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.mysql",
            "NAME": os.getenv("DB_NAME", "votaciones_flv"),
            "USER": os.getenv("DB_USER", "votaciones"),
            "PASSWORD": os.getenv("DB_PASSWORD", ""),
            "HOST": os.getenv("DB_HOST", "127.0.0.1"),
            "PORT": os.getenv("DB_PORT", "3306"),
            "OPTIONS": {"charset": "utf8mb4"},
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

AUTH_USER_MODEL = "votaciones.Usuario"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "es-co"
TIME_ZONE = "America/Bogota"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
# Archivos subidos (imágenes del banner). En Docker: volumen persistente en DJANGO_MEDIA_ROOT.
MEDIA_URL = "/media/"
MEDIA_ROOT = Path(os.getenv("DJANGO_MEDIA_ROOT", BASE_DIR / "media"))

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

# Detrás de Cloudflare + edge_nginx (TLS termina antes de Django)
CSRF_TRUSTED_ORIGINS = env_list("DJANGO_CSRF_TRUSTED_ORIGINS", "")
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_RATES": {
        "login": os.getenv("THROTTLE_LOGIN", "10/min"),
        "votar": os.getenv("THROTTLE_VOTAR", "30/min"),
        "registro": os.getenv("THROTTLE_REGISTRO", "10/min"),
    },
}

CORS_ALLOWED_ORIGINS = env_list(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:8095,http://localhost:5195,http://localhost:5197,http://127.0.0.1:8095,http://127.0.0.1:5195,http://127.0.0.1:5197,https://votaciones.juandiegows.com,https://juandiegows.github.io",
)

# La web lee el nombre del archivo CSV exportado (descarga con fetch + token).
CORS_EXPOSE_HEADERS = ["Content-Disposition"]

SPECTACULAR_SETTINGS = {
    "TITLE": "API – Sistema Web de Votaciones del Festival de la Leyenda Vallenata",
    "DESCRIPTION": (
        "API REST del Sistema Web de Votaciones del Festival de la Leyenda Vallenata "
        "(proyecto académico, Areandina – Desarrollo Web). Jerarquía: Edición → Categoría → "
        "Votación → Opción → Voto. Autenticación: encabezado `Authorization: Token <token>` "
        "obtenido en `/api/auth/login/` o `/api/auth/registro/`."
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    # El alias /api/admin/ no se documenta: la ruta pública de administración es /api/gestion/
    "PREPROCESSING_HOOKS": ["votaciones.esquema.sin_alias_admin"],
    "COMPONENT_SPLIT_REQUEST": True,
    "ENUM_NAME_OVERRIDES": {
        "EstadoEdicionEnum": "votaciones.models.Edicion.Estado",
        "EstadoVotacionEnum": "votaciones.models.Votacion.Estado",
    },
    "TAGS": [
        {"name": "Autenticación", "description": "Registro, inicio y cierre de sesión (RF-01, RF-02)."},
        {"name": "Consulta pública", "description": "Ediciones, categorías, votaciones y resultados (RF-04 a RF-06, RF-15)."},
        {"name": "Votación", "description": "Emisión de voto y comprobantes (RF-07 a RF-09)."},
        {"name": "Administración", "description": "Gestión de ediciones, categorías, votaciones, opciones y resultados (RF-10 a RF-14)."},
        {"name": "Auditoría", "description": "Registro de acciones administrativas (RF-16, RN-12)."},
    ],
}
