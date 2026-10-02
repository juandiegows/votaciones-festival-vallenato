import { ESTADOS } from '../utils/helpers.js';

export default function EstadoBadge({ estado }) {
  const e = ESTADOS[estado] || ESTADOS.programada;
  return (
    <span className={`badge badge-estado ${e.clase}`}>
      <i className={`bi bi-${e.icono} me-1`} aria-hidden="true"></i>
      {e.etiqueta}
    </span>
  );
}
