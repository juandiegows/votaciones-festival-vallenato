// Ilustración original (SVG propio): acordeón, caja y guacharaca. No usa logos oficiales.
export default function HeroAcordeon() {
  const pliegues = Array.from({ length: 9 }, (_, i) => i);
  return (
    <svg className="hero-svg" viewBox="0 0 420 320" role="img" aria-label="Ilustración de un acordeón, una caja y una guacharaca">
      {/* Sol / círculo de fondo */}
      <circle cx="300" cy="90" r="70" fill="#D7AC70" opacity=".9" />
      <circle cx="300" cy="90" r="88" fill="none" stroke="#D7AC70" strokeWidth="2" strokeDasharray="6 10" opacity=".7" />

      {/* Notas musicales */}
      <g fill="#FCE6CC" opacity=".9">
        <ellipse cx="70" cy="70" rx="10" ry="7" />
        <rect x="78" y="28" width="3" height="42" />
        <path d="M81 28 q18 6 14 22 q-2 -10 -14 -12z" />
        <ellipse cx="370" cy="200" rx="8" ry="6" />
        <rect x="376" y="168" width="3" height="32" />
      </g>

      {/* Acordeón */}
      <g transform="translate(60 110) rotate(-6)">
        <rect x="0" y="0" width="70" height="150" rx="10" fill="#DD3333" />
        <rect x="8" y="10" width="54" height="130" rx="6" fill="#B71C1C" />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
          <circle key={i} cx={i % 2 ? 44 : 26} cy={22 + i * 12} r="5" fill="#FCE6CC" />
        ))}
        {/* Fuelle */}
        <g transform="translate(70 6)">
          {pliegues.map((i) => (
            <path
              key={i}
              d={`M${i * 14} 0 L${i * 14 + 7} 6 L${i * 14 + 7} 132 L${i * 14} 138 Z`}
              fill={i % 2 ? '#7D2710' : '#5A1C0B'}
              stroke="#2A0B08"
              strokeWidth="1"
            />
          ))}
          {pliegues.map((i) => (
            <path key={`b${i}`} d={`M${i * 14 + 7} 6 L${i * 14 + 14} 0 L${i * 14 + 14} 138 L${i * 14 + 7} 132 Z`} fill="#3D1207" />
          ))}
          <rect x="0" y="60" width="126" height="6" fill="#D7AC70" opacity=".85" />
        </g>
        <rect x="196" y="0" width="70" height="150" rx="10" fill="#DD3333" />
        <rect x="204" y="10" width="54" height="130" rx="6" fill="#FCE6CC" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <rect key={i} x="210" y={18 + i * 15} width="42" height="10" rx="3" fill={i % 3 === 1 ? '#000000' : '#D7AC70'} />
        ))}
      </g>

      {/* Caja vallenata */}
      <g transform="translate(270 220)">
        <path d="M0 0 L60 0 L52 70 L8 70 Z" fill="#1C1711" />
        <ellipse cx="30" cy="0" rx="30" ry="8" fill="#FCE6CC" stroke="#7D2710" strokeWidth="2" />
        <path d="M6 20 L54 20 M8 40 L52 40" stroke="#D7AC70" strokeWidth="3" />
      </g>

      {/* Guacharaca */}
      <g transform="translate(30 270) rotate(-12)">
        <rect x="0" y="0" width="150" height="16" rx="8" fill="#E9D294" />
        {Array.from({ length: 14 }, (_, i) => (
          <rect key={i} x={12 + i * 9} y="2" width="2.5" height="12" fill="#7D2710" />
        ))}
        <rect x="150" y="3" width="40" height="10" rx="5" fill="#1C1711" />
      </g>
    </svg>
  );
}
