"""
Permisos de la API de administración: cada vista declara qué permiso del catálogo exige cada acción.

  - `recurso = "ediciones"` en un ViewSet: list/retrieve → ediciones.ver, create → .crear,
    update/partial_update → .editar, destroy → .eliminar.
  - `permisos_accion = {"publicar": "votaciones.publicar", …}` para las acciones propias (y para sobrescribir).
  - En una APIView: `permisos_metodo = {"GET": "sitio.ver", "PUT": "sitio.editar", …}`.
Si una acción no tiene permiso declarado, solo la puede usar el administrador (falla cerrada).
"""

from rest_framework.permissions import BasePermission

ACCIONES_CRUD = {
    "list": "ver", "retrieve": "ver", "create": "crear", "update": "editar", "partial_update": "editar",
    "destroy": "eliminar", "metadata": "ver",
}


def permiso_requerido(request, view):
    """Código del permiso que exige la petición, o None si no hay uno declarado."""
    accion = getattr(view, "action", None)
    propios = getattr(view, "permisos_accion", {})
    if accion and accion in propios:
        return propios[accion]
    recurso = getattr(view, "recurso", "")
    if accion in ACCIONES_CRUD and recurso:
        return f"{recurso}.{ACCIONES_CRUD[accion]}"
    metodos = getattr(view, "permisos_metodo", {})
    if request.method in metodos:
        return metodos[request.method]
    if request.method == "OPTIONS" and "GET" in metodos:
        return metodos["GET"]
    return None


class TienePermiso(BasePermission):
    message = "Tu rol no tiene permiso para realizar esta acción."

    def has_permission(self, request, view):
        usuario = request.user
        if not (usuario and usuario.is_authenticated and usuario.accede_panel):
            return False
        codigo = permiso_requerido(request, view)
        return usuario.es_administrador if codigo is None else usuario.tiene_permiso(codigo)


def lectura_escritura(ver, editar, **extra):
    """permisos_accion de un CRUD que se lee con `ver` y se cambia (crear, editar o eliminar) con `editar`."""
    return {"list": ver, "retrieve": ver, "metadata": ver,
            "create": editar, "update": editar, "partial_update": editar, "destroy": editar, **extra}
