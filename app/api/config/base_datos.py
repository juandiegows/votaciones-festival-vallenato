"""
Adaptadores de base de datos (patrón Puerto/Adaptador, igual que votaciones/correo/adaptadores).

El resto del sistema solo usa el ORM de Django; cuál motor hay detrás lo decide DB_ENGINE:
  - mysql  → MySQL 8 con PyMySQL (Docker, VPS y la entrega).
  - sqlite → archivo local para desarrollo rápido y pruebas.
Para agregar otro motor (p. ej. PostgreSQL) se escribe un adaptador y se registra en ADAPTADORES.
"""

import os
from abc import ABC, abstractmethod


class AdaptadorBaseDatos(ABC):
    nombre = ""

    def preparar(self):
        """Ajustes previos a la conexión (drivers, parches). Por defecto, ninguno."""

    @abstractmethod
    def configuracion(self, base_dir):
        """Diccionario para DATABASES["default"]."""


class AdaptadorMySQL(AdaptadorBaseDatos):
    nombre = "mysql"

    def preparar(self):
        # PyMySQL es Python puro (no necesita compilar mysqlclient) y se presenta a Django como MySQLdb
        import pymysql

        pymysql.install_as_MySQLdb()

    def configuracion(self, base_dir):
        return {
            "ENGINE": "django.db.backends.mysql",
            "NAME": os.getenv("DB_NAME", "votaciones_flv"),
            "USER": os.getenv("DB_USER", "votaciones"),
            "PASSWORD": os.getenv("DB_PASSWORD", ""),
            "HOST": os.getenv("DB_HOST", "127.0.0.1"),
            "PORT": os.getenv("DB_PORT", "3306"),
            # Conexiones persistentes: se reutilizan entre peticiones y se verifican antes de usarlas
            "CONN_MAX_AGE": int(os.getenv("DB_CONN_MAX_AGE", "60")),
            "CONN_HEALTH_CHECKS": True,
            "OPTIONS": {
                "charset": "utf8mb4",  # tildes, ñ y emojis
                # Modo estricto: MySQL rechaza datos inválidos en lugar de recortarlos en silencio
                "init_command": "SET sql_mode='STRICT_TRANS_TABLES'",
            },
        }


class AdaptadorSQLite(AdaptadorBaseDatos):
    nombre = "sqlite"

    def configuracion(self, base_dir):
        return {"ENGINE": "django.db.backends.sqlite3", "NAME": base_dir / "db.sqlite3"}


ADAPTADORES = {adaptador.nombre: adaptador for adaptador in (AdaptadorMySQL, AdaptadorSQLite)}


def configurar(motor, base_dir):
    """Prepara el adaptador elegido y devuelve su configuración para DATABASES."""
    clase = ADAPTADORES.get(motor)
    if clase is None:
        from django.core.exceptions import ImproperlyConfigured

        raise ImproperlyConfigured(f"DB_ENGINE «{motor}» no existe. Opciones: {', '.join(ADAPTADORES)}.")
    adaptador = clase()
    adaptador.preparar()
    return adaptador.configuracion(base_dir)
