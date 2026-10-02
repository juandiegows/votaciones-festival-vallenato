// Avatar SVG generado (sin fotos externas): iniciales sobre color derivado del nombre
// Paleta de marca: [fondo, texto] con contraste AA
const COLORES = [
  ['#DD3333', '#FFFFFF'],
  ['#000000', '#D7AC70'],
  ['#D7AC70', '#000000'],
  ['#7D2710', '#FFFFFF'],
  ['#1C1711', '#E9D294'],
];

function iniciales(nombre) {
  const limpio = nombre
    .replace(/\(.*?\)/g, '')
    .replace(/^(Canción|Propuesta|Participante)\s+\S+\s*[–-]?\s*/i, '')
    .replace(/^(Comparsa|Agrupación|Conjunto|Semillero)\s+/i, '')
    .replace(/['’]/g, '');
  const palabras = limpio.split(/[\s–-]+/).filter((p) => p.length > 2);
  return ((palabras[0]?.[0] || '?') + (palabras[1]?.[0] || '')).toUpperCase();
}

export default function Avatar({ nombre, tamano = 56 }) {
  let hash = 0;
  for (const c of nombre) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  const [color, texto] = COLORES[hash % COLORES.length];
  return (
    <span className="d-inline-flex flex-shrink-0" style={{ width: tamano, height: tamano }}>
      <svg viewBox="0 0 56 56" width={tamano} height={tamano} role="img" aria-label={`Imagen ilustrativa de ${nombre}`}>
        <rect width="56" height="56" rx="14" fill={color} />
        <circle cx="46" cy="10" r="14" fill={color === '#DD3333' ? '#000000' : '#DD3333'} opacity=".35" />
        <path d="M0 44 Q14 36 28 44 T56 44 V56 H0Z" fill="#000" opacity=".12" />
        <text x="28" y="35" textAnchor="middle" fontFamily="Poppins, sans-serif" fontWeight="700" fontSize="19" fill={texto}>
          {iniciales(nombre)}
        </text>
      </svg>
    </span>
  );
}
