// Acordeón vallenato animado: el fuelle se abre y se cierra mientras salen notas musicales.
// Ilustración original (no usa imágenes del Festival). Respeta «reducir movimiento» (ver styles.css).
const PLIEGUES = Array.from({ length: 9 }, (_, i) => i);
const BOTONES_PITOS = [[20, 32], [32, 32], [20, 44], [32, 44], [20, 56], [32, 56], [20, 68], [32, 68]];
const BOTONES_BAJOS = [[128, 38], [138, 38], [128, 50], [138, 50], [128, 62], [138, 62]];

export default function AcordeonAnimado({ className = '' }) {
  return (
    <svg className={`acordeon-animado ${className}`} viewBox="0 0 160 100" role="img" aria-label="Acordeón vallenato tocando">
      <g className="acordeon-notas" fill="var(--flv-dorado)" fontFamily="serif" fontSize="16">
        <text x="56" y="18">♪</text>
        <text x="80" y="16">♫</text>
        <text x="102" y="18">♪</text>
      </g>
      <g className="acordeon-fuelle">
        {PLIEGUES.map((i) => (
          <rect key={i} x={44 + i * 8} y="24" width="8" height="52" fill={i % 2 ? '#2A0B08' : '#1C1711'} stroke="var(--flv-dorado)" strokeWidth=".6" />
        ))}
        <line x1="44" y1="50" x2="116" y2="50" stroke="var(--flv-dorado)" strokeWidth=".6" strokeDasharray="2 2" />
      </g>
      <g className="acordeon-pitos">
        <rect x="10" y="20" width="34" height="60" rx="6" fill="var(--flv-rojo)" stroke="var(--flv-dorado)" strokeWidth="1.2" />
        {BOTONES_PITOS.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3.4" fill="#FCE6CC" />)}
      </g>
      <g className="acordeon-bajos">
        <rect x="116" y="20" width="34" height="60" rx="6" fill="var(--flv-rojo)" stroke="var(--flv-dorado)" strokeWidth="1.2" />
        {BOTONES_BAJOS.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.8" fill="var(--flv-dorado)" />)}
        <rect x="124" y="70" width="18" height="4" rx="2" fill="var(--flv-dorado)" />
      </g>
    </svg>
  );
}
