"""Django solo descubre <app>/admin.py: aquí se cargan los registros del panel de cada módulo."""

from .auditoria import admin as auditoria_admin  # noqa: F401
from .cuentas import admin as cuentas_admin  # noqa: F401
from .sitio import admin as sitio_admin  # noqa: F401
from .votacion import admin as votacion_admin  # noqa: F401
