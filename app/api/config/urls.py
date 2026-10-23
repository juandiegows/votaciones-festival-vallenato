import mimetypes

from django.conf import settings
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path, re_path
from django.views.decorators.clickjacking import xframe_options_sameorigin
from django.views.static import serve
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

from votaciones.sitio.seo import sitemap


def salud(request):
    return JsonResponse({"estado": "ok"})


mimetypes.add_type("image/webp", ".webp")  # la imagen slim de Python no lo trae registrado
# pdf.js (revista) se carga como módulo: con text/plain el navegador lo rechaza
mimetypes.add_type("text/javascript", ".mjs")
mimetypes.add_type("application/wasm", ".wasm")


# SAMEORIGIN: la portada incrusta la revista (PDF) en un iframe; con el DENY global el navegador la bloquea
@xframe_options_sameorigin
def media(request, path):
    return serve(request, path, document_root=settings.MEDIA_ROOT)


urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/salud/", salud, name="salud"),
    # Mapa del sitio de la web (SPA); lo declara robots.txt
    path("api/sitemap.xml", sitemap, name="sitemap"),
    path("api/esquema/", SpectacularAPIView.as_view(), name="esquema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="esquema"), name="swagger"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="esquema"), name="redoc"),
    path("api/", include("votaciones.urls")),
    # Imágenes subidas: las sirve Django en todos los entornos (el proxy reenvía /media/ a la API)
    re_path(r"^media/(?P<path>.*)$", media, name="media"),
    # Sitio web con vistas y plantillas Django (Entrega 2): público, registro/sesión y panel /panel/…
    path("", include("portal.urls")),
]

if settings.DEBUG:
    from votaciones.correo.vista_previa import vista_previa

    # Vista previa de las plantillas de correo (solo desarrollo)
    urlpatterns += [
        path("api/correo/vista-previa/", vista_previa, name="correo-vista-previa"),
        path("api/correo/vista-previa/<slug:plantilla>/", vista_previa, name="correo-vista-previa-plantilla"),
    ]
