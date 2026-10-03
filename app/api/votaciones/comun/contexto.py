"""
Interceptor del usuario actual: el middleware guarda el request en curso en un ContextVar (aislado por hilo y por
tarea async) y ModeloTrazable lo consulta al guardar para llenar creado_por / actualizado_por.

El usuario se lee al guardar, no al entrar al middleware: DRF autentica el token dentro de la vista y entonces
asigna request.user al HttpRequest original, que es el que se guarda aquí.
"""

from contextvars import ContextVar

_request_actual = ContextVar("request_actual", default=None)


def usuario_actual():
    """Usuario autenticado del request en curso; None fuera de un request (shell, comandos, migraciones)."""
    request = _request_actual.get()
    usuario = getattr(request, "user", None)
    return usuario if usuario is not None and usuario.is_authenticated else None


class UsuarioActualMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token = _request_actual.set(request)
        try:
            return self.get_response(request)
        finally:
            _request_actual.reset(token)
