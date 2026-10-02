import { useEffect, useState } from 'react';

// Cuenta regresiva hasta una fecha (cierre o apertura de la votación)
export default function Countdown({ hasta, etiqueta }) {
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = Math.max(0, new Date(hasta).getTime() - ahora);
  const partes = [
    ['días', Math.floor(ms / 86400000)],
    ['horas', Math.floor((ms / 3600000) % 24)],
    ['min', Math.floor((ms / 60000) % 60)],
    ['seg', Math.floor((ms / 1000) % 60)],
  ];
  const texto = `${partes[0][1]} días, ${partes[1][1]} horas y ${partes[2][1]} minutos`;
  return (
    <div>
      <p className="small fw-semibold mb-1 text-secondary-flv">{etiqueta}</p>
      <div className="cuenta" role="timer" aria-label={`${etiqueta}: ${texto}`}>
        {partes.map(([n, v]) => (
          <div className="cuenta-item" key={n} aria-hidden="true">
            <strong>{String(v).padStart(2, '0')}</strong>
            <span>{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
