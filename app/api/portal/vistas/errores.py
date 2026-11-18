from django.shortcuts import render


def pagina_error(request, codigo, mensaje=""):
    """Página de error con la marca y el menú del sitio (equivale a pages/errores/PaginaError.jsx)."""
    return render(request, "portal/error.html", {"codigo": codigo, "mensaje": mensaje}, status=codigo)


def csrf_fallido(request, reason=""):
    """CSRF_FAILURE_VIEW: en lugar de la página técnica de Django, la página 403 del sitio con qué hacer."""
    return pagina_error(
        request, 403,
        "La página que enviaste caducó (por ejemplo, la tenías abierta desde antes de iniciar o cerrar sesión). "
        "Vuelve atrás, recarga la página e inténtalo de nuevo.",
    )

