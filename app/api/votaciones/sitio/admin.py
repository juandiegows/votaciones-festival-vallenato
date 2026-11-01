from django.contrib import admin

from ..comun.admin import TrazableAdmin
from .models import ConfiguracionSitio, Revista


@admin.register(Revista)
class RevistaAdmin(TrazableAdmin):
    list_display = ["titulo", "orden", "activa", "publicada_en"]
    list_filter = ["activa"]


@admin.register(ConfiguracionSitio)
class ConfiguracionSitioAdmin(TrazableAdmin):
    # Registro único: se edita, no se crea ni se borra
    list_display = ["nombre_organizacion", "mostrar_swagger"]
    list_editable = ["mostrar_swagger"]
    list_display_links = ["nombre_organizacion"]
    fields = ["mostrar_swagger"]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
