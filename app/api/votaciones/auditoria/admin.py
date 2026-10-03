from django.contrib import admin

from .models import RegistroAuditoria


@admin.register(RegistroAuditoria)
class RegistroAuditoriaAdmin(admin.ModelAdmin):
    list_display = ["fecha_hora", "usuario", "accion", "entidad", "entidad_id", "ip"]
    list_filter = ["accion", "entidad"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
