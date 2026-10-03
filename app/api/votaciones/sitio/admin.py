from django.contrib import admin

from .models import Revista


@admin.register(Revista)
class RevistaAdmin(admin.ModelAdmin):
    list_display = ["titulo", "orden", "activa", "publicada_en"]
    list_filter = ["activa"]
