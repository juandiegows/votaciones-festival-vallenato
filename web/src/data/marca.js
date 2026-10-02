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
