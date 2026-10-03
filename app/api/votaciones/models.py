"""
Punto de registro de modelos de la app. Cada módulo del dominio define los suyos en <módulo>/models.py; Django los
descubre al importarlos aquí y todos comparten la etiqueta «votaciones» (mismas tablas y migraciones).
"""

from .auditoria.models import RegistroAuditoria
from .cuentas.models import Usuario, UsuarioManager
from .sitio.models import BannerInicio, ConfiguracionSitio, RedSocial, Revista
from .votacion.models import Categoria, Edicion, Opcion, Votacion, Voto

__all__ = [
    "BannerInicio",
    "Categoria",
    "ConfiguracionSitio",
    "Edicion",
    "Opcion",
    "RedSocial",
    "RegistroAuditoria",
    "Revista",
    "Usuario",
    "UsuarioManager",
    "Votacion",
    "Voto",
]
