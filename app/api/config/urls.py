from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path


def salud(request):
    return JsonResponse({"estado": "ok"})


urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/salud/", salud, name="salud"),
    path("api/", include("votaciones.urls")),
]
