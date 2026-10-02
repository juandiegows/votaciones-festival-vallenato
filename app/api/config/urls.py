from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView


def salud(request):
    return JsonResponse({"estado": "ok"})


urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/salud/", salud, name="salud"),
    path("api/esquema/", SpectacularAPIView.as_view(), name="esquema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="esquema"), name="swagger"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="esquema"), name="redoc"),
    path("api/", include("votaciones.urls")),
]
