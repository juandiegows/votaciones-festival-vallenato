from django.contrib import admin

COLUMNAS_SOPORTE = ("creado_en", "creado_por", "actualizado_en", "actualizado_por")


class TrazableAdmin(admin.ModelAdmin):
    """Muestra las columnas de soporte en solo lectura; las llena ModeloTrazable con el usuario del request."""

    def get_readonly_fields(self, request, obj=None):
        return (*super().get_readonly_fields(request, obj), *COLUMNAS_SOPORTE)
