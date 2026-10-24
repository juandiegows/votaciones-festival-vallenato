"""Estáticos de producción. El WAF de Cloudflare bloquea (403) cualquier URL con un segmento que empiece por «admin»,
así que los estáticos de Django Admin (static/admin/…) se publican también en static/dj-admin/ y se enlazan desde ahí."""

from pathlib import Path

import django.contrib.admin
from whitenoise.storage import CompressedManifestStaticFilesStorage

PREFIJO_ADMIN = "dj-admin"
# Entrada de STATICFILES_DIRS: collectstatic copia los estáticos de Django Admin con el prefijo libre del WAF
ESTATICOS_ADMIN = (PREFIJO_ADMIN, str(Path(django.contrib.admin.__file__).parent / "static" / "admin"))


class EstaticosProduccion(CompressedManifestStaticFilesStorage):
    def url(self, name, force=False):
        if name and name.startswith("admin/"):
            name = f"{PREFIJO_ADMIN}/{name[len('admin/'):]}"
        return super().url(name, force)
