from django.shortcuts import render


def pagina_error(request, codigo, mensaje=""):
    """Página de error con la marca y el menú del sitio (equivale a pages/errores/PaginaError.jsx)."""
    referencia = getattr(request, "id_solicitud", "") if codigo >= 500 else ""
    return render(request, "portal/error.html", {"codigo": codigo, "mensaje": mensaje, "referencia": referencia}, status=codigo)


def error_servidor(request):
    """handler500: errores fuera de las vistas (las de las vistas las responde el interceptor de registros)."""
    from votaciones.registros.interceptor import respuesta_error_500

    try:
        return respuesta_error_500(request)
    except Exception:  # noqa: BLE001 — si la plantilla también falla, una respuesta mínima
        from django.http import HttpResponseServerError

        return HttpResponseServerError("Error interno del servidor. Referencia: " + getattr(request, "id_solicitud", ""))


def csrf_fallido(request, reason=""):
    """CSRF_FAILURE_VIEW: en lugar de la página técnica de Django, la página 403 del sitio con qué hacer."""
    return pagina_error(
        request, 403,
        "La página que enviaste caducó (por ejemplo, la tenías abierta desde antes de iniciar o cerrar sesión). "
        "Vuelve atrás, recarga la página e inténtalo de nuevo.",
    )

