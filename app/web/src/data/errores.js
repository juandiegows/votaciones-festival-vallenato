// Catálogo de páginas de error del sitio (componente PaginaError y ruta /error/:codigo).
// Cada error dice qué pasó, por qué puede haber pasado y qué puede hacer la persona.

export const ERRORES = {
  400: {
    icono: 'exclamation-diamond',
    titulo: 'Solicitud no válida',
    mensaje: 'El enlace o los datos enviados no tienen el formato esperado.',
    sugerencias: ['Revisa que el enlace esté completo.', 'Si llenaste un formulario, vuelve a intentarlo desde el inicio.'],
  },
  401: {
    icono: 'person-lock',
    titulo: 'Inicia sesión para continuar',
    mensaje: 'Tu sesión terminó o todavía no has ingresado.',
    sugerencias: ['Inicia sesión con tu correo y contraseña.', 'Si no tienes cuenta, regístrate en menos de un minuto.'],
  },
  403: {
    icono: 'shield-lock',
    titulo: 'Acceso restringido',
    mensaje: 'Tu cuenta no tiene permiso para ver esta sección.',
    sugerencias: ['Esta sección es exclusiva para el rol administrador.', 'Si crees que es un error, contacta a la organización del Festival.'],
  },
  404: {
    icono: 'music-note-list',
    titulo: 'No encontramos esta página',
    mensaje: 'La página que buscas no existe o cambió de dirección.',
    sugerencias: ['Revisa que la dirección esté bien escrita.', 'Busca la votación desde «Categorías y votaciones».'],
  },
  408: {
    icono: 'hourglass-split',
    titulo: 'La respuesta tardó demasiado',
    mensaje: 'El servidor no respondió a tiempo.',
    sugerencias: ['Revisa tu conexión a internet.', 'Espera unos segundos y vuelve a intentarlo.'],
  },
  429: {
    icono: 'speedometer',
    titulo: 'Demasiados intentos',
    mensaje: 'Recibimos muchas solicitudes seguidas desde tu conexión.',
    sugerencias: ['Espera un minuto antes de volver a intentarlo.', 'Tus votos ya registrados no se pierden.'],
  },
  500: {
    icono: 'bug',
    titulo: 'Algo salió mal',
    mensaje: 'Ocurrió un error inesperado y no pudimos mostrar esta página.',
    sugerencias: ['Recarga la página.', 'Si el problema continúa, vuelve más tarde: ya quedó registrado.'],
  },
  503: {
    icono: 'tools',
    titulo: 'Servicio no disponible',
    mensaje: 'El sistema de votaciones está en mantenimiento o recibiendo muchas visitas.',
    sugerencias: ['Vuelve a intentarlo en unos minutos.', 'Tus votos registrados están guardados de forma segura.'],
  },
  'sin-conexion': {
    icono: 'wifi-off',
    titulo: 'Sin conexión a internet',
    mensaje: 'Parece que tu dispositivo perdió la conexión.',
    sugerencias: ['Revisa el wifi o los datos móviles.', 'Cuando vuelvas a estar en línea, pulsa «Reintentar».'],
  },
};

export const CODIGOS_ERROR = Object.keys(ERRORES);
