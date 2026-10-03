import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent


def cargar_env(ruta):
    """Lee app/api/.env en desarrollo local; las variables ya definidas (Docker env_file) tienen prioridad."""
    if not ruta.is_file():
        return
    for linea in ruta.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("#") or "=" not in linea:
            continue
        clave, valor = linea.split("=", 1)
        os.environ.setdefault(clave.strip(), valor.strip().strip("'\""))


cargar_env(BASE_DIR / ".env")


def env_bool(name, default=False):
    return os.getenv(name, str(default)).lower() in ("1", "true", "yes", "si")


def env_list(name, default=""):
    return [v.strip() for v in os.getenv(name, default).split(",") if v.strip()]


CLAVE_DESARROLLO = "dev-insecure-cambiar-en-produccion"
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY") or CLAVE_DESARROLLO
DEBUG = env_bool("DJANGO_DEBUG", True)
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")
# Sin DEBUG (producción, CI) la clave es obligatoria: con la de desarrollo cualquiera podría firmar
# los enlaces de confirmación de correo.
if not DEBUG and SECRET_KEY == CLAVE_DESARROLLO:
    raise ImproperlyConfigured("Define DJANGO_SECRET_KEY (clave larga y aleatoria) cuando DJANGO_DEBUG=false.")

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

# Proxies de confianza delante de Django. La IP del cliente (auditoría, votos y límites de peticiones) se toma
# de X-Forwarded-For contando estos saltos desde el final; con 0 se usa REMOTE_ADDR y el encabezado se ignora,
# así nadie puede falsear su IP enviándolo. Producción (edge_nginx → Django): 1.
NUM_PROXIES = int(os.getenv("DJANGO_NUM_PROXIES", "0"))

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Correo transaccional (votaciones/correo). CORREO_ADAPTADOR elige el proveedor: consola (desarrollo), smtp o
# zeptomail. Para agregar otro proveedor: crear la clase en votaciones/correo/adaptadores/ y registrarla aquí.
CORREO_ADAPTADORES = {
    "consola": "votaciones.correo.adaptadores.consola.AdaptadorConsola",
    "smtp": "votaciones.correo.adaptadores.smtp.AdaptadorSMTP",
    "zeptomail": "votaciones.correo.adaptadores.zeptomail.AdaptadorZeptoMail",
    "memoria": "votaciones.correo.adaptadores.memoria.AdaptadorMemoria",
}
CORREO_ADAPTADOR = os.getenv("CORREO_ADAPTADOR", "consola")
CORREO_REMITENTE = os.getenv("CORREO_REMITENTE", "no-responder@votaciones.juandiegows.com")
CORREO_REMITENTE_NOMBRE = os.getenv("CORREO_REMITENTE_NOMBRE", "Votaciones Festival Vallenato")
CORREO_RESPONDER_A = os.getenv("CORREO_RESPONDER_A", "")
# URL pública de la web (React): base de los enlaces de los correos
CORREO_URL_SITIO = os.getenv("CORREO_URL_SITIO", "http://localhost:5195")
DEFAULT_FROM_EMAIL = CORREO_REMITENTE
# Entregar los correos del registro y del voto en un hilo aparte para no demorar la respuesta de la API
CORREO_EN_SEGUNDO_PLANO = env_bool("CORREO_EN_SEGUNDO_PLANO", True)
# Vigencia del enlace para confirmar el correo
CORREO_CONFIRMACION_HORAS = int(os.getenv("CORREO_CONFIRMACION_HORAS", "48"))

# Adaptador smtp (backend SMTP de Django)
EMAIL_HOST = os.getenv("EMAIL_HOST", "localhost")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", True)
EMAIL_USE_SSL = env_bool("EMAIL_USE_SSL", False)
EMAIL_TIMEOUT = int(os.getenv("EMAIL_TIMEOUT", "15"))

# Adaptador zeptomail (API HTTP de ZeptoMail, Zoho)
ZEPTOMAIL_TOKEN = os.getenv("ZEPTOMAIL_TOKEN", "")
ZEPTOMAIL_API_URL = os.getenv("ZEPTOMAIL_API_URL", "https://api.zeptomail.com/v1.1/email")
ZEPTOMAIL_BOUNCE_ADDRESS = os.getenv("ZEPTOMAIL_BOUNCE_ADDRESS", "")
ZEPTOMAIL_TIMEOUT = int(os.getenv("ZEPTOMAIL_TIMEOUT", "15"))

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.TokenAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "NUM_PROXIES": NUM_PROXIES,
    "DEFAULT_THROTTLE_RATES": {
        "login": os.getenv("THROTTLE_LOGIN", "10/min"),
        "votar": os.getenv("THROTTLE_VOTAR", "30/min"),
        "registro": os.getenv("THROTTLE_REGISTRO", "10/min"),
        "confirmacion": os.getenv("THROTTLE_CONFIRMACION", "5/min"),
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
