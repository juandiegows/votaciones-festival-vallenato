from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Categoria, Edicion, Opcion, RegistroAuditoria, Revista, Usuario, Votacion, Voto


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    ordering = ["email"]
    list_display = ["email", "nombres", "apellidos", "rol", "is_active", "fecha_registro"]
    list_filter = ["rol", "is_active"]
    search_fields = ["email", "nombres", "apellidos"]
    fieldsets = [
        (None, {"fields": ["email", "password"]}),
        ("Datos personales", {"fields": ["nombres", "apellidos", "acepta_tratamiento_datos"]}),
        ("Permisos", {"fields": ["rol", "is_active", "is_staff", "is_superuser"]}),
        ("Fechas", {"fields": ["fecha_registro", "last_login"]}),
    ]
    add_fieldsets = [
        (None, {"classes": ["wide"], "fields": ["email", "nombres", "apellidos", "rol", "password1", "password2"]}),
    ]


class OpcionInline(admin.TabularInline):
    model = Opcion
    extra = 0


@admin.register(Edicion)
class EdicionAdmin(admin.ModelAdmin):
    list_display = ["nombre", "anio", "fecha_inicio", "fecha_fin", "estado"]


@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    list_display = ["nombre", "edicion", "activa", "orden"]
    list_filter = ["edicion", "activa"]


@admin.register(Votacion)
class VotacionAdmin(admin.ModelAdmin):
    list_display = ["titulo", "categoria", "fecha_apertura", "fecha_cierre", "publicada", "estado"]
    list_filter = ["categoria__edicion", "categoria", "publicada"]
    inlines = [OpcionInline]


@admin.register(Revista)
class RevistaAdmin(admin.ModelAdmin):
    list_display = ["titulo", "orden", "activa", "publicada_en"]
    list_filter = ["activa"]


@admin.register(Voto)
class VotoAdmin(admin.ModelAdmin):
    list_display = ["codigo_comprobante", "votacion", "opcion", "usuario", "fecha_hora"]
    list_filter = ["votacion"]

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(RegistroAuditoria)
class RegistroAuditoriaAdmin(admin.ModelAdmin):
    list_display = ["fecha_hora", "usuario", "accion", "entidad", "entidad_id", "ip"]
    list_filter = ["accion", "entidad"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
