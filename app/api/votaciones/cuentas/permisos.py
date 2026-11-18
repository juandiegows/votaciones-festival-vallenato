"""
Catálogo de permisos: cada funcionalidad de la administración es un permiso con un código estable («modulo.accion»).
Un rol es un conjunto de permisos (modelo Rol). Los roles del sistema:
  - votante: sin permisos de administración (solo vota y consulta lo público).
  - lectura: consulta todo el panel sin cambiar nada.
  - editor: lee y escribe solo ediciones, categorías, votaciones y sus opciones.
  - administrador: acceso total; es el único que siempre tiene todos los permisos (no se edita).
Los permisos de «lectura» y «editor» se pueden ajustar desde el panel (roles.gestionar) y se pueden crear roles nuevos.
"""

# (grupo, [(código, descripción), …]) — el orden es el que se muestra en el panel
GRUPOS = [
    ("Panel", [
        ("panel.ver", "Entrar al panel y ver el inicio"),
    ]),
    ("Ediciones", [
        ("ediciones.ver", "Ver ediciones"),
        ("ediciones.crear", "Crear ediciones"),
        ("ediciones.editar", "Editar ediciones"),
        ("ediciones.eliminar", "Eliminar ediciones"),
        ("ediciones.importar", "Importar una edición desde Excel"),
        ("ediciones.exportar", "Descargar la plantilla y la estructura de una edición"),
    ]),
    ("Categorías", [
        ("categorias.ver", "Ver categorías"),
        ("categorias.crear", "Crear categorías"),
        ("categorias.editar", "Editar, activar y desactivar categorías"),
        ("categorias.eliminar", "Eliminar categorías"),
    ]),
    ("Votaciones", [
        ("votaciones.ver", "Ver votaciones"),
        ("votaciones.crear", "Crear votaciones"),
        ("votaciones.editar", "Editar votaciones"),
        ("votaciones.eliminar", "Eliminar votaciones"),
        ("votaciones.publicar", "Publicar, despublicar y cerrar votaciones"),
    ]),
    ("Opciones", [
        ("opciones.ver", "Ver las opciones de una votación"),
        ("opciones.crear", "Crear opciones"),
        ("opciones.editar", "Editar, activar y desactivar opciones"),
        ("opciones.eliminar", "Eliminar opciones"),
    ]),
    ("Votos y resultados", [
        ("resultados.ver", "Ver votos, resultados y participación"),
        ("resultados.publicar", "Publicar u ocultar resultados"),
        ("resultados.exportar", "Exportar resultados (PDF, Excel, CSV, JSON o SQL)"),
    ]),
    ("Auditoría", [
        ("auditoria.ver", "Ver la auditoría, la integridad de los votos y la autoría"),
    ]),
    ("Sitio público", [
        ("sitio.ver", "Ver banners, revistas, contacto, redes e identidad visual"),
        ("sitio.editar", "Cambiar banners, revistas, contacto, redes e identidad visual"),
    ]),
    ("Configuración", [
        ("configuracion.ver", "Ver la configuración del sistema"),
        ("configuracion.editar", "Cambiar la configuración del sistema"),
        ("configuracion.demo", "Eliminar o volver a cargar los datos de demostración"),
    ]),
    ("Usuarios", [
        ("usuarios.ver", "Ver los usuarios registrados"),
        ("usuarios.cambiar_rol", "Cambiar el rol de un usuario"),
    ]),
    ("Roles y permisos", [
        ("roles.ver", "Ver los roles y sus permisos"),
        ("roles.gestionar", "Crear, editar y eliminar roles y cambiar sus permisos"),
    ]),
    ("Sistema", [
        ("registros.ver", "Ver los registros técnicos: errores del servidor y de la web, con su traza"),
        ("django_admin.acceder", "Entrar a Django Admin"),
    ]),
]

PERMISOS = {codigo: descripcion for _, permisos in GRUPOS for codigo, descripcion in permisos}
TODOS = frozenset(PERMISOS)

# Roles del sistema (códigos estables)
VOTANTE, LECTURA, EDITOR, ADMINISTRADOR = "votante", "lectura", "editor", "administrador"
# Sus permisos no se editan: el votante no administra y el administrador siempre lo tiene todo
ROLES_FIJOS = (VOTANTE, ADMINISTRADOR)

_ESCRITURA_CONTENIDO = ("ediciones.", "categorias.", "votaciones.", "opciones.")

ROLES_INICIALES = [
    {"codigo": VOTANTE, "nombre": "Votante", "orden": 1,
     "descripcion": "Se registra en el sitio y vota. No entra al panel.", "permisos": []},
    {"codigo": LECTURA, "nombre": "Solo lectura", "orden": 2,
     "descripcion": "Consulta todo el panel sin cambiar nada.",
     # Los registros técnicos (trazas, IP) quedan para el administrador; se pueden dar desde Roles y permisos
     "permisos": sorted(c for c in TODOS if (c.endswith(".ver") and c != "registros.ver")
                        or c in ("ediciones.exportar", "resultados.exportar"))},
    {"codigo": EDITOR, "nombre": "Lectura y escritura", "orden": 3,
     "descripcion": "Lee y escribe solo ediciones, categorías, votaciones y sus opciones.",
     "permisos": sorted({"panel.ver"} | {c for c in TODOS if c.startswith(_ESCRITURA_CONTENIDO)})},
    {"codigo": ADMINISTRADOR, "nombre": "Administrador", "orden": 4,
     "descripcion": "Acceso total: además cambia roles, usuarios y permisos.", "permisos": sorted(TODOS)},
]


def grupos_con_estado(permisos):
    """Catálogo agrupado con la marca de cuáles tiene un rol (para pintar las casillas)."""
    activos = set(permisos)
    return [
        {"grupo": grupo, "permisos": [{"codigo": c, "descripcion": d, "activo": c in activos} for c, d in lista]}
        for grupo, lista in GRUPOS
    ]


def validos(codigos):
    """Solo los códigos que existen en el catálogo, sin repetir y en orden."""
    return sorted(set(codigos) & TODOS)
