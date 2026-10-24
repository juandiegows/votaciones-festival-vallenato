from django.contrib import admin

from ..comun.admin import TrazableAdmin
from .models import Categoria, Edicion, Opcion, Votacion, Voto
from .servicios import opciones_bloqueadas


class OpcionInline(admin.TabularInline):
    model = Opcion
    extra = 0

    # RN-19: con la votación abierta, cerrada o con votos las opciones quedan de solo lectura (obj es la votación)
    def has_add_permission(self, request, obj=None):
        return super().has_add_permission(request, obj) and not (obj and opciones_bloqueadas(obj))

    def has_change_permission(self, request, obj=None):
        return super().has_change_permission(request, obj) and not (obj and opciones_bloqueadas(obj))

    def has_delete_permission(self, request, obj=None):
        return super().has_delete_permission(request, obj) and not (obj and opciones_bloqueadas(obj))


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
