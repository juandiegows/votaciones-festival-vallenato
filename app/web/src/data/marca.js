// Paleta de marca (fuente única para la guía #/marca). Ver también docs/BRANDING.md y src/styles/brand.css
// Colores tomados de festivalvallenato.com (revisado el 2 oct 2026). Los funcionales son derivados.

export const GRUPOS_COLOR = [
  {
    grupo: 'Primarios',
    colores: [
      { token: '--flv-rojo', nombre: 'Rojo Festival', hex: '#DD3333', uso: 'Botones primarios, enlaces, navegación activa y acentos.', par: '#FFFFFF' },
      { token: '--flv-negro', nombre: 'Negro Tarima', hex: '#000000', uso: 'Fondo de navbar, hero, banda de cifras y pie de página.', par: '#FFFFFF' },
      { token: '--flv-dorado', nombre: 'Dorado Leyenda', hex: '#D7AC70', uso: 'Títulos y detalles SOLO sobre fondos oscuros; números de la cuenta regresiva.', par: '#000000' },
    ],
  },
  {
    grupo: 'Secundarios',
    colores: [
      { token: '--flv-dorado-claro', nombre: 'Dorado claro', hex: '#E9D294', uso: 'Etiquetas de la cuenta regresiva y textos secundarios sobre negro.', par: '#000000' },
      { token: '--flv-crema', nombre: 'Crema', hex: '#FCE6CC', uso: 'Fondos suaves, resaltados y avisos informativos.', par: '#1C1711' },
      { token: '--flv-ocre', nombre: 'Ocre Valledupar', hex: '#7D2710', uso: 'Final del degradado del hero (#000000 → #2A0B08 → #7D2710).', par: '#FFFFFF' },
      { token: '--flv-carbon', nombre: 'Carbón', hex: '#1C1711', uso: 'Superficies oscuras y texto fuerte sobre fondos claros.', par: '#E9D294' },
    ],
  },
  {
    grupo: 'Neutros',
    colores: [
      { token: '--flv-gris-texto', nombre: 'Gris texto', hex: '#555555', uso: 'Texto de cuerpo.', par: '#F8F8F8' },
      { token: '--flv-gris-borde', nombre: 'Gris borde', hex: '#E9E9E9', uso: 'Bordes, divisores y fondo de barras.', par: '#000000' },
      { token: '--flv-fondo', nombre: 'Fondo', hex: '#F8F8F8', uso: 'Fondo general de las páginas.', par: '#555555' },
      { token: '--flv-blanco', nombre: 'Blanco', hex: '#FFFFFF', uso: 'Tarjetas, formularios y texto sobre fondos oscuros.', par: '#000000' },
    ],
  },
  {
    grupo: 'Funcionales (derivados para accesibilidad)',
    colores: [
      { token: '--flv-rojo-hover', nombre: 'Rojo oscuro', hex: '#B71C1C', uso: 'Hover/presionado del primario, errores y enlaces sobre #F8F8F8.', par: '#FFFFFF' },
      { token: '--flv-dorado-texto', nombre: 'Dorado texto', hex: '#8A6A2E', uso: 'Dorado cuando se usa como texto sobre blanco.', par: '#FFFFFF' },
      { token: '--flv-rojo-sobre-oscuro', nombre: 'Rojo sobre oscuro', hex: '#FF5A5A', uso: 'Texto rojo sobre negro o carbón (nav activo).', par: '#1C1711' },
      { token: '--flv-estado-abierta', nombre: 'Estado Abierta', hex: '#2E7D32', uso: 'Insignia «Abierta» (texto blanco).', par: '#FFFFFF' },
      { token: '--flv-estado-programada', nombre: 'Estado Programada', hex: '#8A6A2E', uso: 'Insignia «Programada» (texto blanco).', par: '#FFFFFF' },
      { token: '--flv-estado-cerrada', nombre: 'Estado Cerrada', hex: '#555555', uso: 'Insignia «Cerrada» (texto blanco).', par: '#FFFFFF' },
    ],
  },
];

export function hexARgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminancia(hex) {
  const [r, g, b] = hexARgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Relación de contraste WCAG 2.x entre dos colores */
export function contraste(a, b) {
  const [l1, l2] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

export function nivelWcag(ratio) {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'AA texto grande';
  return 'Solo decorativo';
}

// ---------- Tema editable (configuracion.marca) ----------
// Se guarda solo lo que difiere de la marca base: { colores: { token: hex }, botones: { primario, secundario } }.
// Los colores se aplican como variables CSS en :root y los botones como reglas para .btn-primary (primario)
// y .btn-outline-primary (secundario), así que todo el sitio cambia sin tocar cada pantalla.

export const TOKEN_PRIMARIO = '--flv-rojo';
export const TOKEN_SECUNDARIO = '--flv-ocre';

export const COLORES_BASE = Object.fromEntries(GRUPOS_COLOR.flatMap((g) => g.colores.map((c) => [c.token, c.hex])));

export const ESTILOS_BOTON = [
  { id: 'relleno', nombre: 'Relleno', desc: 'Fondo sólido del color.' },
  { id: 'contorno', nombre: 'Contorno', desc: 'Borde del color; se rellena al pasar el cursor.' },
  { id: 'suave', nombre: 'Suave', desc: 'Fondo tenue del mismo tono.' },
  { id: 'degradado', nombre: 'Degradado', desc: 'Degradado diagonal del color.' },
  { id: 'relieve', nombre: 'Relieve', desc: 'Sólido con sombra inferior (efecto 3D).' },
  { id: 'texto', nombre: 'Solo texto', desc: 'Sin fondo ni borde, como un enlace.' },
];

export const FORMAS_BOTON = [
  { id: 'recta', nombre: 'Recta', radio: '0' },
  { id: 'suave', nombre: 'Suave', radio: '.5rem' },
  { id: 'redondeada', nombre: 'Redondeada', radio: '1rem' },
  { id: 'pildora', nombre: 'Píldora', radio: '999px' },
];

export const PESOS_BOTON = [
  { id: '500', nombre: 'Normal' },
  { id: '600', nombre: 'Seminegrita' },
  { id: '700', nombre: 'Negrita' },
  { id: '800', nombre: 'Extranegrita' },
];

// color/colorTexto vacíos = heredado (color del rol y texto con mejor contraste)
export const BOTONES_BASE = {
  primario: { estilo: 'relleno', color: '', colorTexto: '', forma: 'suave', peso: '600', mayusculas: false },
  secundario: { estilo: 'contorno', color: '', colorTexto: '', forma: 'suave', peso: '600', mayusculas: false },
};

// Mensajes de alerta (.alert-* y .aviso-crema). «clasico» = aspecto actual de Bootstrap + marca.
export const ESTILOS_ALERTA = [
  { id: 'clasico', nombre: 'Clásico', desc: 'Fondo pastel con borde fino.' },
  { id: 'lateral', nombre: 'Barra lateral', desc: 'Fondo tenue y barra de color a la izquierda.' },
  { id: 'solido', nombre: 'Sólido', desc: 'Fondo lleno del color, texto contrastado.' },
  { id: 'contorno', nombre: 'Contorno', desc: 'Fondo blanco con borde del color.' },
  { id: 'tarjeta', nombre: 'Tarjeta', desc: 'Fondo blanco, barra superior y sombra.' },
  { id: 'minimo', nombre: 'Mínimo', desc: 'Sin fondo; solo una línea del color.' },
];

export const ALERTAS_BASE = { estilo: 'clasico', forma: 'suave' };

// Tonos de alerta: selectores del sitio y token del color que los define
export const TONOS_ALERTA = [
  { id: 'info', nombre: 'Información', selectores: ['.alert-info', '.aviso-crema'], token: '--flv-ocre', fondoClasico: '--flv-crema' },
  { id: 'exito', nombre: 'Éxito', selectores: ['.alert-success'], token: '--flv-estado-abierta' },
  { id: 'aviso', nombre: 'Advertencia', selectores: ['.alert-warning'], token: '--flv-dorado-texto' },
  { id: 'error', nombre: 'Error', selectores: ['.alert-danger'], token: '--flv-rojo-hover' },
  { id: 'neutro', nombre: 'Neutro', selectores: ['.alert-secondary'], token: '--flv-estado-cerrada' },
];

export const ROLES_BOTON = {
  primario: { nombre: 'Botón primario', colorNombre: 'color primario', token: TOKEN_PRIMARIO, selector: '.btn-primary' },
  secundario: { nombre: 'Botón secundario', colorNombre: 'color secundario', token: TOKEN_SECUNDARIO, selector: '.btn-outline-primary' },
};

const HEX = /^#[0-9a-f]{6}$/i;
export const esHex = (v) => typeof v === 'string' && HEX.test(v);

/** Marca guardada (posiblemente incompleta o antigua) → marca completa y válida */
export function normalizarMarca(marca) {
  const m = marca && typeof marca === 'object' ? marca : {};
  const colores = { ...COLORES_BASE };
  Object.entries(m.colores || {}).forEach(([token, hex]) => {
    if (token in COLORES_BASE && esHex(hex)) colores[token] = hex.toUpperCase();
  });
  const boton = (rol) => {
    const b = { ...BOTONES_BASE[rol], ...(m.botones?.[rol] || {}) };
    if (!ESTILOS_BOTON.some((e) => e.id === b.estilo)) b.estilo = BOTONES_BASE[rol].estilo;
    if (!FORMAS_BOTON.some((f) => f.id === b.forma)) b.forma = BOTONES_BASE[rol].forma;
    if (!PESOS_BOTON.some((p) => p.id === b.peso)) b.peso = BOTONES_BASE[rol].peso;
    b.color = esHex(b.color) ? b.color.toUpperCase() : '';
    b.colorTexto = esHex(b.colorTexto) ? b.colorTexto.toUpperCase() : '';
    b.mayusculas = !!b.mayusculas;
    return b;
  };
  const alertas = { ...ALERTAS_BASE, ...(m.alertas || {}) };
  if (!ESTILOS_ALERTA.some((e) => e.id === alertas.estilo)) alertas.estilo = ALERTAS_BASE.estilo;
  if (!FORMAS_BOTON.some((f) => f.id === alertas.forma)) alertas.forma = ALERTAS_BASE.forma;
  return { colores, botones: { primario: boton('primario'), secundario: boton('secundario') }, alertas: { estilo: alertas.estilo, forma: alertas.forma } };
}

/** Marca completa → lo que se guarda (solo diferencias con la base) */
export function compactarMarca(marca) {
  const colores = Object.fromEntries(Object.entries(marca.colores).filter(([t, hex]) => hex.toUpperCase() !== COLORES_BASE[t].toUpperCase()));
  const botones = {};
  Object.entries(marca.botones).forEach(([rol, b]) => {
    const dif = Object.fromEntries(Object.entries(b).filter(([k, v]) => v !== BOTONES_BASE[rol][k]));
    if (Object.keys(dif).length) botones[rol] = dif;
  });
  const alertas = Object.fromEntries(Object.entries(marca.alertas || {}).filter(([k, v]) => v !== ALERTAS_BASE[k]));
  return Object.keys(alertas).length ? { colores, botones, alertas } : { colores, botones };
}

/** Mezcla dos colores: peso 0 → a, 1 → b */
export function mezclar(a, b, peso) {
  const x = hexARgb(a);
  const y = hexARgb(b);
  return `#${x.map((c, i) => Math.round(c + (y[i] - c) * peso).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

/** Texto sobre un fondo: blanco si cumple AA (4,5:1, como en la marca: blanco sobre rojo); si no, el de más contraste */
export const textoLegible = (fondo) =>
  contraste(fondo, '#FFFFFF') >= 4.5 || contraste(fondo, '#FFFFFF') >= contraste(fondo, '#000000') ? '#FFFFFF' : '#000000';

/** Oscurece (o aclara) el color hasta que se lea como texto sobre el fondo (AA 4,5:1) */
export function colorTextoSobre(color, fondo) {
  const destino = contraste(fondo, '#000000') >= contraste(fondo, '#FFFFFF') ? '#000000' : '#FFFFFF';
  let c = color;
  for (let i = 1; contraste(c, fondo) < 4.5 && i <= 10; i++) c = mezclar(color, destino, i / 10);
  return c;
}

const rgb = (hex) => hexARgb(hex).join(', ');

/** Propiedades CSS de un botón por estado (normal, hover, active, disabled) */
export function estadosBoton(b, colorRol) {
  const c = b.color || colorRol;
  const oscuro = mezclar(c, '#000000', 0.18);
  const masOscuro = mezclar(c, '#000000', 0.32);
  const sobre = (fondo) => b.colorTexto || textoLegible(fondo);
  const comun = {
    'border-radius': FORMAS_BOTON.find((f) => f.id === b.forma).radio,
    'font-weight': b.peso,
    'text-transform': b.mayusculas ? 'uppercase' : 'none',
    'letter-spacing': b.mayusculas ? '.04em' : 'normal',
    '--bs-btn-focus-shadow-rgb': rgb(c),
    'background-image': 'none',
    'box-shadow': 'none',
    'text-decoration': 'none',
  };
  const deshabilitadoSolido = { '--bs-btn-disabled-bg': '#A9A9A9', '--bs-btn-disabled-border-color': '#A9A9A9', '--bs-btn-disabled-color': '#000000' };
  const deshabilitadoLigero = { '--bs-btn-disabled-bg': 'transparent', '--bs-btn-disabled-border-color': '#BBBBBB', '--bs-btn-disabled-color': '#767676' };
  const solido = (fondo, hover, active) => ({
    '--bs-btn-bg': fondo, '--bs-btn-border-color': fondo, '--bs-btn-color': sobre(fondo),
    '--bs-btn-hover-bg': hover, '--bs-btn-hover-border-color': hover, '--bs-btn-hover-color': sobre(hover),
    '--bs-btn-active-bg': active, '--bs-btn-active-border-color': active, '--bs-btn-active-color': sobre(active),
  });

  switch (b.estilo) {
    case 'contorno': {
      const texto = b.colorTexto || colorTextoSobre(c, '#FFFFFF');
      return {
        normal: {
          ...comun, ...deshabilitadoLigero, '--bs-btn-bg': 'transparent', '--bs-btn-border-color': c, '--bs-btn-color': texto,
          '--bs-btn-hover-bg': c, '--bs-btn-hover-border-color': c, '--bs-btn-hover-color': textoLegible(c),
          '--bs-btn-active-bg': oscuro, '--bs-btn-active-border-color': oscuro, '--bs-btn-active-color': textoLegible(oscuro),
        },
      };
    }
    case 'suave': {
      const fondo = mezclar(c, '#FFFFFF', 0.86);
      const hover = mezclar(c, '#FFFFFF', 0.72);
      const active = mezclar(c, '#FFFFFF', 0.6);
      const texto = b.colorTexto || colorTextoSobre(c, active);
      return {
        normal: {
          ...comun, ...deshabilitadoLigero, '--bs-btn-bg': fondo, '--bs-btn-border-color': fondo, '--bs-btn-color': texto,
          '--bs-btn-hover-bg': hover, '--bs-btn-hover-border-color': hover, '--bs-btn-hover-color': texto,
          '--bs-btn-active-bg': active, '--bs-btn-active-border-color': active, '--bs-btn-active-color': texto,
        },
      };
    }
    case 'degradado': {
      const claro = mezclar(c, '#FFFFFF', 0.18);
      return {
        normal: {
          ...comun, ...deshabilitadoSolido, ...solido(c, oscuro, masOscuro), '--bs-btn-border-color': 'transparent',
          '--bs-btn-hover-border-color': 'transparent', 'background-image': `linear-gradient(135deg, ${claro} 0%, ${c} 45%, ${masOscuro} 100%)`,
        },
        hover: { 'background-image': `linear-gradient(135deg, ${c} 0%, ${oscuro} 50%, ${masOscuro} 100%)` },
        disabled: { 'background-image': 'none' },
      };
    }
    case 'relieve':
      return {
        normal: {
          ...comun, ...deshabilitadoSolido, ...solido(c, oscuro, oscuro), 'box-shadow': `0 4px 0 ${masOscuro}`,
          '--bs-btn-active-shadow': `0 1px 0 ${masOscuro}`, transition: 'transform .1s, box-shadow .1s, background-color .15s',
        },
        hover: { transform: 'translateY(-1px)', 'box-shadow': `0 5px 0 ${masOscuro}` },
        active: { transform: 'translateY(3px)', 'box-shadow': `0 1px 0 ${masOscuro}` },
        disabled: { 'box-shadow': 'none', transform: 'none' },
      };
    case 'texto': {
      const texto = b.colorTexto || colorTextoSobre(c, '#FFFFFF');
      return {
        normal: {
          ...comun, '--bs-btn-bg': 'transparent', '--bs-btn-border-color': 'transparent', '--bs-btn-color': texto,
          '--bs-btn-hover-bg': mezclar(c, '#FFFFFF', 0.9), '--bs-btn-hover-border-color': 'transparent', '--bs-btn-hover-color': texto,
          '--bs-btn-active-bg': mezclar(c, '#FFFFFF', 0.8), '--bs-btn-active-border-color': 'transparent', '--bs-btn-active-color': texto,
          '--bs-btn-disabled-bg': 'transparent', '--bs-btn-disabled-border-color': 'transparent', '--bs-btn-disabled-color': '#767676',
        },
        hover: { 'text-decoration': 'underline' },
      };
    }
    default:
      return { normal: { ...comun, ...deshabilitadoSolido, ...solido(c, oscuro, masOscuro) } };
  }
}

const bloque = (selector, props) => (props ? `${selector}{${Object.entries(props).map(([k, v]) => `${k}:${v}`).join(';')}}` : '');

/** Reglas CSS de un botón para uno o varios selectores */
export function cssBoton(selectores, b, colorRol) {
  const e = estadosBoton(b, colorRol);
  const sel = (sufijo) => selectores.map((s) => `${s}${sufijo}`).join(',');
  return bloque(sel(''), e.normal) + bloque(sel(':hover'), e.hover) + bloque(sel(':active'), e.active) + bloque(sel(':disabled'), e.disabled);
}

/** Reglas CSS de los mensajes de alerta; `prefijo` limita las reglas a un contenedor (muestras) */
export function cssAlertas(alertas, colores, prefijo = '') {
  const { estilo, forma } = alertas;
  if (estilo === 'clasico' && forma === ALERTAS_BASE.forma && !prefijo) return '';
  const radio = FORMAS_BOTON.find((f) => f.id === forma).radio;
  return TONOS_ALERTA.map((t) => {
    const c = colores[t.token];
    const sel = (sufijo = '') => t.selectores.map((s) => `${prefijo}${s}${sufijo}`).join(',');
    let p;
    let fondo = '#FFFFFF';
    switch (estilo) {
      case 'lateral':
        fondo = t.fondoClasico ? colores[t.fondoClasico] : mezclar(c, '#FFFFFF', 0.9);
        p = { background: fondo, border: '0', 'border-left': `5px solid ${c}`, 'box-shadow': 'none' };
        break;
      case 'solido':
        fondo = c;
        p = { background: c, border: `1px solid ${c}`, 'box-shadow': 'none' };
        break;
      case 'contorno':
        p = { background: '#FFFFFF', border: `2px solid ${c}`, 'box-shadow': 'none' };
        break;
      case 'tarjeta':
        p = { background: '#FFFFFF', border: `1px solid ${colores['--flv-gris-borde']}`, 'border-top': `4px solid ${c}`, 'box-shadow': '0 6px 18px rgba(0,0,0,.08)' };
        break;
      case 'minimo':
        fondo = colores['--flv-fondo'];
        p = { background: 'transparent', border: '0', 'border-bottom': `2px solid ${c}`, 'box-shadow': 'none', 'padding-left': '0', 'padding-right': '0' };
        break;
      default: {
        // Clásico: solo cambia la forma; en las muestras se restablece el aspecto de Bootstrap
        const reset = t.fondoClasico
          ? { background: colores[t.fondoClasico], color: colores['--flv-carbon'], border: '1px solid #F0CFA5' }
          : { background: 'var(--bs-alert-bg)', color: 'var(--bs-alert-color)', border: 'var(--bs-alert-border)' };
        return bloque(sel(), { 'border-radius': radio, ...(prefijo ? { ...reset, 'box-shadow': 'none' } : {}) });
      }
    }
    const texto = estilo === 'solido' ? textoLegible(c) : colorTextoSobre(mezclar(c, '#000000', 0.25), fondo);
    const reglas = bloque(sel(), { ...p, color: texto, 'border-radius': estilo === 'minimo' ? '0' : radio }) +
      bloque(`${sel(' a')},${sel(' .alert-link')}`, { color: texto });
    return texto === '#FFFFFF' ? reglas + bloque(sel(' .btn-close'), { filter: 'invert(1) grayscale(1) brightness(2)' }) : reglas;
  }).join('');
}

/** Hoja de estilos del tema: variables de color en :root + botones primario y secundario */
export function cssMarca(marca) {
  const { colores, botones, alertas } = normalizarMarca(marca);
  const primario = colores[TOKEN_PRIMARIO];
  const vars = {
    ...colores,
    '--bs-primary-rgb': rgb(primario),
    '--bs-link-color-rgb': rgb(primario),
    '--bs-link-hover-color-rgb': rgb(colores['--flv-rojo-hover']),
    '--bs-focus-ring-color': `rgba(${rgb(primario)}, 0.35)`,
    '--bs-success-rgb': rgb(colores['--flv-estado-abierta']),
    '--bs-danger-rgb': rgb(colores['--flv-rojo-hover']),
    '--bs-warning-rgb': rgb(colores['--flv-dorado']),
  };
  const negro = colores['--flv-negro'];
  const ocre = colores['--flv-ocre'];
  if (negro !== COLORES_BASE['--flv-negro'] || ocre !== COLORES_BASE['--flv-ocre']) {
    vars['--flv-degradado-hero'] = `linear-gradient(135deg, ${negro} 0%, ${mezclar(negro, ocre, 0.34)} 55%, ${ocre} 100%)`;
  }
  return bloque(':root', vars) +
    Object.entries(ROLES_BOTON).map(([rol, r]) => cssBoton([r.selector], botones[rol], colores[r.token])).join('') +
    cssAlertas(alertas, colores);
}
