import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import EstadoBadge from '../components/EstadoBadge.jsx';
import { formatearFechaHora } from '../utils/helpers.js';
import { useRutas } from '../hooks/useRutas.js';
import { useSeo } from '../hooks/useSeo.js';

export default function MisVotos() {
  const { misVotos, votaciones, opciones, categorias, edicionActiva } = useApp();
  const rutas = useRutas();
  useSeo({ titulo: 'Mis votos', indexar: false });
  const mios = [...misVotos].sort((a, b) => b.fechaHora.localeCompare(a.fechaHora));

  return (
    <div className="container py-4 py-md-5">
      <PageHeader
        titulo="Mis votos"
        subtitulo="Historial de tus votos y comprobantes."
        migas={[{ label: 'Inicio', to: '/' }, { label: 'Mis votos' }]}
      />
      {mios.length === 0 ? (
        <div className="card-flv p-4 text-center">
          <i className="bi bi-inbox fs-1 text-secondary" aria-hidden="true"></i>
          <p>Aún no has votado.</p>
          <Link to={edicionActiva ? rutas.edicion(edicionActiva) : '/'} className="btn btn-primary">Ver votaciones</Link>
        </div>
      ) : (
        <ul className="list-unstyled row g-3">
          {mios.map((v) => {
            const votacion = votaciones.find((x) => x.id === v.votacionId);
            const opcion = opciones.find((o) => o.id === v.opcionId);
            const categoria = categorias.find((c) => c.id === votacion?.categoriaId);
            return (
              <li className="col-md-6" key={v.id}>
                <article className="card-flv p-3 h-100">
                  <div className="d-flex justify-content-between gap-2 mb-2">
                    <span className="small text-secondary-flv">{categoria?.nombre}</span>
                    {votacion && <EstadoBadge estado={votacion.estado} />}
                  </div>
                  <h2 className="h5 mb-1">{votacion?.titulo || v.votacionTitulo}</h2>
                  <p className="mb-2">Tu elección: <strong>{opcion?.nombre || v.opcionNombre}</strong></p>
                  <p className="small mb-2 text-secondary-flv">{formatearFechaHora(v.fechaHora)}</p>
                  <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <code className="fs-6 fw-bold text-dorado-texto">{v.codigoComprobante}</code>
                    <Link to={rutas.comprobanteDeVoto(v, votacion)} className="btn btn-sm btn-outline-primary">Ver comprobante</Link>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
