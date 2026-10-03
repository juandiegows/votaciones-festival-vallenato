from django.contrib import admin

from ..comun.admin import TrazableAdmin
from .models import Categoria, Edicion, Opcion, Votacion, Voto


class OpcionInline(admin.TabularInline):
    model = Opcion
    extra = 0


@admin.register(Edicion)
class EdicionAdmin(TrazableAdmin):
    list_display = ["nombre", "anio", "fecha_inicio", "fecha_fin", "estado"]


@admin.register(Categoria)
class CategoriaAdmin(TrazableAdmin):
    list_display = ["nombre", "edicion", "activa", "orden"]
    list_filter = ["edicion", "activa"]


@admin.register(Votacion)
class VotacionAdmin(TrazableAdmin):
    list_display = ["titulo", "categoria", "fecha_apertura", "fecha_cierre", "publicada", "estado"]
    list_filter = ["categoria__edicion", "categoria", "publicada"]
    inlines = [OpcionInline]


@admin.register(Voto)
class VotoAdmin(admin.ModelAdmin):
    list_display = ["codigo_comprobante", "votacion", "opcion", "usuario", "fecha_hora"]
    list_filter = ["votacion"]

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
