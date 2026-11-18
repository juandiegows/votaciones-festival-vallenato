/**
 * Registros del sistema del modo demostración (/panel/registros sin la API).
 * DATOS ILUSTRATIVOS Y FICTICIOS: muestran cómo se ve un error del servidor y uno de la web. Las fechas se calculan
 * respecto al momento actual para que los filtros por periodo funcionen. En el modo API los registros reales los
 * escribe el interceptor de Django y POST /api/registros/web/.
 */
const HORA = 60 * 60 * 1000;
const NAVEGADOR = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

const hace = (horas) => new Date(Date.now() - horas * HORA).toISOString();

export function registrosDemo() {
  return [
    {
      id: 3,
      fechaHora: hace(2),
      nivel: 'ERROR',
      fuente: 'web',
      origen: 'web.cliente',
      mensaje: "TypeError: Cannot read properties of undefined (reading 'nombre') (ejemplo ilustrativo)",
      excepcion: "TypeError: Cannot read properties of undefined (reading 'nombre')",
      ubicacion: 'assets/index-ejemplo.js:12 (columna 3456)',
      archivo: 'assets/index-ejemplo.js',
      linea: 12,
      funcion: 'columna 3456',
      traza: "TypeError: Cannot read properties of undefined (reading 'nombre')\n    at TarjetaOpcion (assets/index-ejemplo.js:12:3456)\n    at renderWithHooks (assets/index-ejemplo.js:8:1200)\n\nComponentes de React:\n    at TarjetaOpcion\n    at VotacionDetalle\n    at Layout",
      metodo: 'POST',
      ruta: '/api/registros/web/',
      estadoHttp: 204,
      referencia: 'demo0003',
      usuario: 'votante@festival.test',
      ip: '192.0.2.10',
      navegador: NAVEGADOR,
      detalle: { url: 'https://votaciones.ejemplo.test/2027/categorias/musica/cancion-favorita-del-publico', version: '' },
    },
    {
      id: 2,
      fechaHora: hace(30),
      nivel: 'ERROR',
      fuente: 'servidor',
      origen: 'django.request',
      mensaje: 'Error de prueba provocado por admin@festival.test para verificar los registros del sistema. (ejemplo ilustrativo)',
      excepcion: 'ErrorDePrueba: Error de prueba provocado por admin@festival.test para verificar los registros del sistema.',
      ubicacion: 'votaciones/registros/views.py:25 (provocar_error_de_prueba)',
      archivo: 'votaciones/registros/views.py',
      linea: 25,
      funcion: 'provocar_error_de_prueba',
      traza: 'Traceback (most recent call last):\n  File "votaciones/registros/views.py", line 74, in probar\n    provocar_error_de_prueba(request.user)\n  File "votaciones/registros/views.py", line 25, in provocar_error_de_prueba\n    raise ErrorDePrueba(...)\nErrorDePrueba: Error de prueba provocado por admin@festival.test para verificar los registros del sistema.',
      metodo: 'POST',
      ruta: '/api/gestion/registros/probar/',
      estadoHttp: 500,
      referencia: 'demo0002',
      usuario: 'admin@festival.test',
      ip: '192.0.2.20',
      navegador: NAVEGADOR,
      detalle: {},
    },
    {
      id: 1,
      fechaHora: hace(24 * 9),
      nivel: 'WARNING',
      fuente: 'servidor',
      origen: 'votaciones.correo',
      mensaje: 'No se pudo enviar el correo de confirmación; se reintentará más tarde. (ejemplo ilustrativo)',
      excepcion: '',
      ubicacion: '',
      archivo: '',
      linea: null,
      funcion: '',
      traza: '',
      metodo: '',
      ruta: '',
      estadoHttp: null,
      referencia: '',
      usuario: null,
      ip: '',
      navegador: '',
      detalle: {},
    },
  ];
}

/** Filtra como la API: nivel, fuente, últimos N días y texto (referencia, mensaje, archivo, ruta o correo). */
export function filtrarRegistros(lista, { nivel = '', fuente = '', dias = '', q = '' } = {}) {
  const texto = q.trim().toLowerCase();
  const desde = dias ? Date.now() - Number(dias) * 24 * HORA : 0;
  return lista.filter((r) =>
    (!nivel || r.nivel === nivel)
    && (!fuente || r.fuente === fuente)
    && (!desde || new Date(r.fechaHora).getTime() >= desde)
    && (!texto || [r.referencia, r.mensaje, r.excepcion, r.archivo, r.ruta, r.usuario].some((v) => (v || '').toLowerCase().includes(texto))));
}

/** Errores (ERROR y CRITICAL) de las últimas 24 horas y 7 días, y el más reciente. */
export function resumirRegistros(lista) {
  const errores = lista.filter((r) => r.nivel === 'ERROR' || r.nivel === 'CRITICAL');
  const desde = (horas) => errores.filter((r) => new Date(r.fechaHora).getTime() >= Date.now() - horas * HORA).length;
  const ultimo = [...errores].sort((a, b) => b.fechaHora.localeCompare(a.fechaHora))[0];
  return { errores24h: desde(24), errores7d: desde(24 * 7), ultimoError: ultimo?.fechaHora || null };
}
