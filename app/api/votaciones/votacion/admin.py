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
    list_display = ["nombre", "edicion", "activa", "voto_unico", "orden"]
    list_filter = ["edicion", "activa", "voto_unico"]

    # RN-04: con votos registrados el modo de voto queda de solo lectura
    def get_readonly_fields(self, request, obj=None):
        campos = list(super().get_readonly_fields(request, obj))
        return campos + ["voto_unico"] if obj and obj.votos.exists() else campos


@admin.register(Votacion)
class VotacionAdmin(TrazableAdmin):
    list_display = ["titulo", "categoria", "fecha_apertura", "fecha_cierre", "publicada", "estado"]
    list_filter = ["categoria__edicion", "categoria", "publicada"]
    inlines = [OpcionInline]


@admin.register(Voto)
class VotoAdmin(admin.ModelAdmin):
    list_display = ["codigo_comprobante", "edicion", "categoria", "votacion", "opcion", "usuario", "fecha_hora"]
    list_filter = ["edicion", "categoria", "votacion"]
    search_fields = ["codigo_comprobante", "usuario__email"]
    list_select_related = ["edicion", "categoria", "votacion", "opcion", "usuario"]

    # Los votos solo se registran desde el sitio (RN-02 a RN-05): aquí son de solo lectura
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
