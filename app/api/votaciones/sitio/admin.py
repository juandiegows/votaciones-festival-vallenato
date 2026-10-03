from django.contrib import admin

from ..comun.admin import TrazableAdmin
from .models import Revista


@admin.register(Revista)
class RevistaAdmin(TrazableAdmin):
    list_display = ["titulo", "orden", "activa", "publicada_en"]
    list_filter = ["activa"]
