import IconoEntidad from '../IconoEntidad.jsx';
import EstadoBadge from '../EstadoBadge.jsx';

const n = (x) => x.toLocaleString('es-CO');

/**
 * Resumen de toda la edición: categoría (total) › votación (total) › opciones (votos y %).
 * `onElegir(votacionId)` abre el detalle de una votación.
 */
export default function ResumenResultados({ resumen, onElegir }) {
  if (!resumen.categorias.length) {
    return <div className="card-flv p-4 text-center">Esta edición aún no tiene categorías.</div>;
  }
  return (
    <div className="d-grid gap-3">
      {resumen.categorias.map((c) => (
        <section key={c.id} className="card-flv p-3 p-md-4" aria-labelledby={`res-cat-${c.id}`}>
          <div className="d-flex justify-content-between align-items-center gap-2 border-bottom pb-2 mb-2">
            <h2 id={`res-cat-${c.id}`} className="h5 mb-0 d-flex align-items-center gap-2">
              <span className="icono-circulo icono-circulo-sm"><IconoEntidad icono={c.icono} imagen={c.iconoImagen} /></span>
              {c.nombre}
            </h2>
            <span className="resumen-total" aria-label={`${n(c.totalVotos)} votos en la categoría`}>{n(c.totalVotos)}</span>
          </div>
          {c.votaciones.length === 0 && <p className="small text-secondary-flv mb-0">Sin votaciones.</p>}
          {c.votaciones.map((v) => (
            <div key={v.id} className="resumen-votacion">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                <button type="button" className="btn btn-link p-0 fw-semibold text-start text-reset" onClick={() => onElegir(v.id)} aria-label={`Ver detalle de ${v.titulo}`}>
                  {v.titulo}
                </button>
                <span className="d-flex align-items-center gap-2">
                  {v.publicada ? <EstadoBadge estado={v.estado} /> : <span className="badge text-bg-secondary">Borrador</span>}
                  <strong>{n(v.totalVotos)}</strong>
                </span>
              </div>
              <ul className="list-unstyled mb-0 mt-1">
                {v.opciones.map((o, i) => (
                  <li key={o.id} className="resumen-opcion">
                    <span className="text-truncate">{o.nombre}</span>
                    <span className="resumen-barra" aria-hidden="true"><span style={{ width: `${o.porcentaje}%` }} className={i === 0 && o.votos > 0 ? 'lider' : ''}></span></span>
                    <span className="text-nowrap small"><strong>{n(o.votos)}</strong> · {o.porcentaje.toFixed(1)} %</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
