// Formas de presentar al público las categorías de una edición y las opciones de una votación.
// El administrador elige una por edición (categorías) y una por votación (opciones).

export const PRESENTACIONES_CATEGORIAS = [
  { valor: 'tarjetas', etiqueta: 'Tarjetas', icono: 'grid-3x2-gap', descripcion: 'Tarjetas con ícono, descripción y número de votaciones (tres por fila).' },
  { valor: 'lista', etiqueta: 'Lista', icono: 'list-ul', descripcion: 'Una fila por categoría, ideal para leer rápido en el celular.' },
  { valor: 'mosaico', etiqueta: 'Mosaico', icono: 'grid-fill', descripcion: 'Bloques grandes y centrados con el ícono como protagonista.' },
  { valor: 'compacta', etiqueta: 'Compacta', icono: 'ui-radios-grid', descripcion: 'Botones tipo píldora en una sola franja; útil con muchas categorías.' },
  { valor: 'destacada', etiqueta: 'Destacada', icono: 'star-fill', descripcion: 'La primera categoría en grande y las demás en tarjetas pequeñas.' },
];

export const PRESENTACIONES_OPCIONES = [
  { valor: 'tarjetas', etiqueta: 'Tarjetas', icono: 'grid-3x2-gap', descripcion: 'Dos tarjetas por fila con imagen, nombre y descripción.' },
  { valor: 'lista', etiqueta: 'Lista', icono: 'list-ul', descripcion: 'Una fila por opción, con la descripción completa.' },
  { valor: 'mosaico', etiqueta: 'Mosaico', icono: 'grid-fill', descripcion: 'Bloques grandes con la imagen arriba; tres por fila.' },
  { valor: 'compacta', etiqueta: 'Compacta', icono: 'ui-radios-grid', descripcion: 'Botones tipo píldora solo con el nombre; para muchas opciones cortas.' },
  { valor: 'reproductor', etiqueta: 'Reproductor', icono: 'music-note-list', descripcion: 'Lista de reproducción: el audio y su texto en primer plano.' },
];

const buscar = (lista, valor) => lista.find((p) => p.valor === valor) || lista[0];
export const presentacionCategorias = (valor) => buscar(PRESENTACIONES_CATEGORIAS, valor);
export const presentacionOpciones = (valor) => buscar(PRESENTACIONES_OPCIONES, valor);

// Íconos de Bootstrap Icons que el administrador puede elegir para categorías y votaciones
export const ICONOS_DISPONIBLES = [
  { nombre: 'music-note-beamed', etiqueta: 'Notas musicales' },
  { nombre: 'music-note', etiqueta: 'Nota musical' },
  { nombre: 'music-note-list', etiqueta: 'Lista de canciones' },
  { nombre: 'music-player-fill', etiqueta: 'Reproductor' },
  { nombre: 'vinyl-fill', etiqueta: 'Disco de vinilo' },
  { nombre: 'disc-fill', etiqueta: 'Disco' },
  { nombre: 'boombox-fill', etiqueta: 'Equipo de sonido' },
  { nombre: 'speaker-fill', etiqueta: 'Parlante' },
  { nombre: 'headphones', etiqueta: 'Audífonos' },
  { nombre: 'mic-fill', etiqueta: 'Micrófono' },
  { nombre: 'soundwave', etiqueta: 'Onda de sonido' },
  { nombre: 'volume-up-fill', etiqueta: 'Volumen' },
  { nombre: 'broadcast', etiqueta: 'Transmisión' },
  { nombre: 'cassette-fill', etiqueta: 'Casete' },
  { nombre: 'film', etiqueta: 'Video' },
  { nombre: 'camera-fill', etiqueta: 'Cámara' },
  { nombre: 'people-fill', etiqueta: 'Grupo de personas' },
  { nombre: 'person-fill', etiqueta: 'Persona' },
  { nombre: 'person-hearts', etiqueta: 'Persona querida' },
  { nombre: 'emoji-smile-fill', etiqueta: 'Alegría' },
  { nombre: 'balloon-fill', etiqueta: 'Fiesta' },
  { nombre: 'balloon-heart-fill', etiqueta: 'Celebración' },
  { nombre: 'stars', etiqueta: 'Estrellas' },
  { nombre: 'star-fill', etiqueta: 'Estrella' },
  { nombre: 'brightness-high-fill', etiqueta: 'Sol' },
  { nombre: 'moon-stars-fill', etiqueta: 'Noche' },
  { nombre: 'heart-fill', etiqueta: 'Corazón' },
  { nombre: 'fire', etiqueta: 'Fuego' },
  { nombre: 'award-fill', etiqueta: 'Medalla' },
  { nombre: 'trophy-fill', etiqueta: 'Trofeo' },
  { nombre: 'gem', etiqueta: 'Joya' },
  { nombre: 'patch-check-fill', etiqueta: 'Sello de calidad' },
  { nombre: 'flag-fill', etiqueta: 'Bandera' },
  { nombre: 'palette-fill', etiqueta: 'Paleta de colores' },
  { nombre: 'brush-fill', etiqueta: 'Pincel' },
  { nombre: 'scissors', etiqueta: 'Vestuario y costura' },
  { nombre: 'feather', etiqueta: 'Pluma' },
  { nombre: 'flower1', etiqueta: 'Flor' },
  { nombre: 'tree-fill', etiqueta: 'Naturaleza' },
  { nombre: 'water', etiqueta: 'Río' },
  { nombre: 'geo-alt-fill', etiqueta: 'Lugar' },
  { nombre: 'book-fill', etiqueta: 'Historia y tradición' },
  { nombre: 'pencil-fill', etiqueta: 'Composición' },
  { nombre: 'check2-square', etiqueta: 'Votación' },
];

export const etiquetaIcono = (nombre) => ICONOS_DISPONIBLES.find((i) => i.nombre === nombre)?.etiqueta || 'Ícono personalizado';
