from django.shortcuts import render


def pagina_error(request, codigo, mensaje=""):
    """Página de error con la marca y el menú del sitio (equivale a pages/errores/PaginaError.jsx)."""
    return render(request, "portal/error.html", {"codigo": codigo, "mensaje": mensaje}, status=codigo)
