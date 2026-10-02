import { Link } from 'react-router-dom';
import EstadoBadge from './EstadoBadge.jsx';
import { formatearFechaHora } from '../utils/helpers.js';
import { useRutas } from '../hooks/useRutas.js';

export default function VotacionCard({ votacion, categoria, numOpciones, yaVoto }) {
  const rutas = useRutas();
  return (
    <article className="card-flv interactiva h-100 p-3 d-flex flex-column">
      <div className="d-flex align-items-start gap-3 mb-2">
        <span className="icono-circulo" aria-hidden="true"><i className={`bi bi-${votacion.imagen || categoria?.icono || 'check2-square'}`}></i></span>
        <div className="flex-grow-1">
          <div className="d-flex flex-wrap gap-1 mb-1">
            <EstadoBadge estado={votacion.estado} />
            {yaVoto && <span className="badge badge-estado estado-abierta"><i className="bi bi-check2-circle me-1" aria-hidden="true"></i>Ya votaste</span>}
          </div>
          <h3 className="h5 mb-0">{votacion.titulo}</h3>
          {categoria && <p className="small text-secondary-flv mb-0">{categoria.nombre}</p>}
        </div>
      </div>
      <p className="small mb-2">{votacion.descripcion}</p>
      <ul className="list-unstyled small text-secondary-flv mb-3">
        <li><i className="bi bi-calendar-check me-1" aria-hidden="true"></i>Abre: {formatearFechaHora(votacion.fechaApertura)}</li>
        <li><i className="bi bi-calendar-x me-1" aria-hidden="true"></i>Cierra: {formatearFechaHora(votacion.fechaCierre)}</li>
        <li><i className="bi bi-list-ol me-1" aria-hidden="true"></i>{numOpciones} opciones</li>
      </ul>
      <Link
        to={rutas.votacion(votacion)}
        className={`btn ${votacion.estado === 'abierta' && !yaVoto ? 'btn-primary' : 'btn-outline-primary'} mt-auto`}
        aria-label={`${votacion.estado === 'abierta' && !yaVoto ? 'Votar en' : 'Ver detalle de'} ${votacion.titulo}`}
      >
        {votacion.estado === 'abierta' && !yaVoto ? 'Ver y votar' : 'Ver detalle'}
        <i className="bi bi-arrow-right ms-1" aria-hidden="true"></i>
      </Link>
    </article>
  );
}
