from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import Usuario


@admin.register(Usuario)
class UsuarioAdmin(UserAdmin):
    ordering = ["email"]
    list_display = ["email", "nombres", "apellidos", "tipo_documento", "numero_documento", "correo_verificado", "rol", "is_active", "fecha_registro"]
    list_filter = ["rol", "is_active", "correo_verificado"]
    search_fields = ["email", "nombres", "apellidos", "numero_documento"]
    fieldsets = [
        (None, {"fields": ["email", "password"]}),
        ("Datos personales", {"fields": ["nombres", "apellidos", "tipo_documento", "numero_documento", "acepta_tratamiento_datos"]}),
        ("Verificación", {"fields": ["correo_verificado"]}),
        ("Permisos", {"fields": ["rol", "is_active", "is_staff", "is_superuser"]}),
        ("Fechas", {"fields": ["fecha_registro", "last_login"]}),
    ]
    add_fieldsets = [
        (None, {"classes": ["wide"], "fields": ["email", "nombres", "apellidos", "rol", "password1", "password2"]}),
    ]
