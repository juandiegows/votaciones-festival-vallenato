"""Textos e íconos fijos de la interfaz (los mismos de la web React: app/web/src/data/presentaciones.js y helpers.js)."""

from types import SimpleNamespace

ESTADOS = {
    "abierta": {"etiqueta": "Abierta", "clase": "estado-abierta", "icono": "unlock-fill"},
    "programada": {"etiqueta": "Programada", "clase": "estado-programada", "icono": "calendar-event"},
    "cerrada": {"etiqueta": "Cerrada", "clase": "estado-cerrada", "icono": "lock-fill"},
    "borrador": {"etiqueta": "Borrador", "clase": "estado-cerrada", "icono": "pencil-square"},
}

# Visibilidad de resultados como la lee el público
VISIBILIDAD = {
    "tiempo_real": "en tiempo real",
    "al_cierre": "al cerrar",
    "no_publicar": "no publicar",
}

DESCRIPCION_VISIBILIDAD = {
    "tiempo_real": "El público ve el conteo mientras la votación está abierta.",
    "al_cierre": "El público ve los resultados cuando la votación cierra.",
    "no_publicar": "El público no ve los resultados (solo la administración).",
}

PRESENTACIONES_CATEGORIAS = [
    {"valor": "tarjetas", "etiqueta": "Tarjetas", "icono": "grid-3x2-gap",
     "descripcion": "Tarjetas con ícono, descripción y número de votaciones (tres por fila)."},
    {"valor": "lista", "etiqueta": "Lista", "icono": "list-ul",
     "descripcion": "Una fila por categoría, ideal para leer rápido en el celular."},
    {"valor": "mosaico", "etiqueta": "Mosaico", "icono": "grid-fill",
     "descripcion": "Bloques grandes y centrados con el ícono como protagonista."},
    {"valor": "compacta", "etiqueta": "Compacta", "icono": "ui-radios-grid",
     "descripcion": "Botones tipo píldora en una sola franja; útil con muchas categorías."},
    {"valor": "destacada", "etiqueta": "Destacada", "icono": "star-fill",
     "descripcion": "La primera categoría en grande y las demás en tarjetas pequeñas."},
]

PRESENTACIONES_OPCIONES = [
    {"valor": "tarjetas", "etiqueta": "Tarjetas", "icono": "grid-3x2-gap",
     "descripcion": "Dos tarjetas por fila con imagen, nombre y descripción."},
    {"valor": "lista", "etiqueta": "Lista", "icono": "list-ul",
     "descripcion": "Una fila por opción, con la descripción completa."},
    {"valor": "mosaico", "etiqueta": "Mosaico", "icono": "grid-fill",
     "descripcion": "Bloques grandes con la imagen arriba; tres por fila."},
    {"valor": "compacta", "etiqueta": "Compacta", "icono": "ui-radios-grid",
     "descripcion": "Botones tipo píldora solo con el nombre; para muchas opciones cortas."},
    {"valor": "reproductor", "etiqueta": "Reproductor", "icono": "music-note-list",
     "descripcion": "Lista de reproducción: el audio y su texto en primer plano."},
    {"valor": "colores", "etiqueta": "Colores (tipo Kahoot)", "icono": "palette-fill",
     "descripcion": "Bloques grandes de colores con una figura; se vota con un toque, ideal en el celular o en pantalla gigante."},
    {"valor": "respuestas", "etiqueta": "Respuestas (tipo Quizizz)", "icono": "ui-checks",
     "descripcion": "Botones a todo el ancho con su letra (A, B, C, D) y color; para preguntas tipo trivia o encuesta."},
    {"valor": "duelo", "etiqueta": "Duelo", "icono": "lightning-charge-fill",
     "descripcion": "Las opciones frente a frente con un «VS» en medio; ideal para una final entre dos."},
]

# Opciones de ejemplo para la vista previa del panel cuando la votación aún no tiene dos opciones
OPCIONES_EJEMPLO = [
    SimpleNamespace(pk=f"ejemplo{i}", nombre=nombre, descripcion=descripcion, audio=None, enlace_multimedia="",
                    texto_audio="")
    for i, (nombre, descripcion) in enumerate([
        ("Paseo", "El aire más cantado, de ritmo pausado."),
        ("Merengue", "Alegre y bailable, con el acordeón al frente."),
        ("Son", "Cadencioso, marcado por el bajo del acordeón."),
        ("Puya", "El más rápido: virtuosismo de caja y guacharaca."),
    ], start=1)
]

# Íconos de Bootstrap Icons que el administrador puede elegir para categorías y votaciones
ICONOS_DISPONIBLES = [
    ("music-note-beamed", "Notas musicales"), ("music-note", "Nota musical"), ("music-note-list", "Lista de canciones"),
    ("music-player-fill", "Reproductor"), ("vinyl-fill", "Disco de vinilo"), ("disc-fill", "Disco"),
    ("boombox-fill", "Equipo de sonido"), ("speaker-fill", "Parlante"), ("headphones", "Audífonos"),
    ("mic-fill", "Micrófono"), ("soundwave", "Onda de sonido"), ("volume-up-fill", "Volumen"),
    ("broadcast", "Transmisión"), ("cassette-fill", "Casete"), ("film", "Video"), ("camera-fill", "Cámara"),
    ("people-fill", "Grupo de personas"), ("person-fill", "Persona"), ("person-hearts", "Persona querida"),
    ("emoji-smile-fill", "Alegría"), ("balloon-fill", "Fiesta"), ("balloon-heart-fill", "Celebración"),
    ("stars", "Estrellas"), ("star-fill", "Estrella"), ("brightness-high-fill", "Sol"), ("moon-stars-fill", "Noche"),
    ("heart-fill", "Corazón"), ("fire", "Fuego"), ("award-fill", "Medalla"), ("trophy-fill", "Trofeo"), ("gem", "Joya"),
    ("patch-check-fill", "Sello de calidad"), ("flag-fill", "Bandera"), ("palette-fill", "Paleta de colores"),
    ("brush-fill", "Pincel"), ("scissors", "Vestuario y costura"), ("feather", "Pluma"), ("flower1", "Flor"),
    ("tree-fill", "Naturaleza"), ("water", "Río"), ("geo-alt-fill", "Lugar"), ("book-fill", "Historia y tradición"),
    ("pencil-fill", "Composición"), ("check2-square", "Votación"),
]

PASOS_INICIO = [
    {"icono": "person-plus", "titulo": "Regístrate",
     "texto": "Crea tu cuenta con tu correo y acepta la política de tratamiento de datos."},
    {"icono": "grid-3x3-gap", "titulo": "Explora", "texto": "Revisa las categorías y las votaciones abiertas de la edición."},
    {"icono": "hand-index-thumb", "titulo": "Elige y confirma",
     "texto": "Selecciona tu opción favorita y confirma tu voto. ¡Solo una vez!"},
    {"icono": "receipt", "titulo": "Recibe tu comprobante", "texto": "Obtén un código único que respalda tu participación."},
]

FILTROS_ESTADO = [("todas", "Todas"), ("abierta", "Abiertas"), ("programada", "Programadas"), ("cerrada", "Cerradas")]

# Cuentas que crea `python manage.py cargar_demo` (solo se muestran en desarrollo)
CREDENCIALES_DEMO = [
    {"rol": "Votante", "correo": "votante@festival.test", "contrasena": "Voto2027*"},
    {"rol": "Administrador", "correo": "admin@festival.test", "contrasena": "Admin2027*"},
]
