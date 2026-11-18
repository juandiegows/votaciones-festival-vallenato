from django.contrib import admin

from .models import RegistroSistema


@admin.register(RegistroSistema)
class RegistroSistemaAdmin(admin.ModelAdmin):
    list_display = ["fecha_hora", "nivel", "fuente", "origen", "excepcion", "archivo", "linea", "ruta", "usuario"]
    list_filter = ["nivel", "fuente", "origen"]
    search_fields = ["mensaje", "excepcion", "archivo", "ruta", "id_solicitud"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
