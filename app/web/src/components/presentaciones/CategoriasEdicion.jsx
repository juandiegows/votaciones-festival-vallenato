import { Link } from 'react-router-dom';
import IconoEntidad from '../IconoEntidad.jsx';

const contar = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`;

function Insignias({ total, abiertas }) {
  return (
    <span className="d-flex flex-wrap gap-2 small">
      <span className="badge rounded-pill text-bg-light border">{contar(total, 'votación', 'votaciones')}</span>
      {abiertas > 0 && <span className="badge badge-estado estado-abierta">{abiertas} abierta{abiertas > 1 ? 's' : ''}</span>}
    </span>
  );
}

function Tarjeta({ c, ruta, total, abiertas, grande = false }) {
  return (
    <Link to={ruta} className="text-reset text-decoration-none d-block h-100" aria-label={`${c.nombre}: ${contar(total, 'votación', 'votaciones')}, ${abiertas} abiertas`}>
      <article className={`card-flv interactiva h-100 p-4 ${grande ? 'categoria-destacada' : ''}`}>
        <div className="d-flex align-items-center gap-3 mb-3">
          <span className={`icono-circulo ${grande ? 'icono-lg' : ''}`} aria-hidden="true"><IconoEntidad icono={c.icono} imagen={c.iconoImagen} /></span>
          <h2 className={grande ? 'h3 mb-0' : 'h5 mb-0'}>{c.nombre}</h2>
        </div>
        <p className={grande ? 'mb-3' : 'small mb-3'}>{c.descripcion}</p>
        <Insignias total={total} abiertas={abiertas} />
        <span className="d-inline-block mt-3 enlace-mas text-rojo">Ver votaciones <i className="bi bi-arrow-right" aria-hidden="true"></i></span>
      </article>
    </Link>
  );
}

/**
 * Categorías de una edición en una de las 5 presentaciones que elige el administrador:
 * tarjetas, lista, mosaico, compacta y destacada.
 * `items`: [{ categoria, ruta, total, abiertas }]
 */
export default function CategoriasEdicion({ items, presentacion = 'tarjetas' }) {
  if (presentacion === 'lista') {
    return (
      <ul className="list-unstyled d-grid gap-2 mb-0">
        {items.map(({ categoria: c, ruta, total, abiertas }) => (
          <li key={c.id}>
            <Link to={ruta} className="card-flv interactiva d-flex align-items-center gap-3 p-3 text-reset text-decoration-none" aria-label={`${c.nombre}: ${contar(total, 'votación', 'votaciones')}, ${abiertas} abiertas`}>
              <span className="icono-circulo icono-sm" aria-hidden="true"><IconoEntidad icono={c.icono} imagen={c.iconoImagen} /></span>
              <span className="flex-grow-1">
                <span className="d-block h6 mb-0">{c.nombre}</span>
                <span className="d-block small text-secondary-flv">{c.descripcion}</span>
              </span>
              <span className="d-none d-sm-block"><Insignias total={total} abiertas={abiertas} /></span>
              <i className="bi bi-chevron-right text-rojo" aria-hidden="true"></i>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  if (presentacion === 'mosaico') {
    return (
      <div className="row g-3">
        {items.map(({ categoria: c, ruta, total, abiertas }) => (
          <div className="col-6 col-md-4 col-xl-3" key={c.id}>
            <Link to={ruta} className="categoria-mosaico card-flv interactiva text-reset text-decoration-none" aria-label={`${c.nombre}: ${contar(total, 'votación', 'votaciones')}, ${abiertas} abiertas`}>
              <span className="icono-circulo icono-lg" aria-hidden="true"><IconoEntidad icono={c.icono} imagen={c.iconoImagen} /></span>
              <span className="h6 mb-1 mt-3 d-block">{c.nombre}</span>
              <span className="small text-secondary-flv">{contar(total, 'votación', 'votaciones')}</span>
              {abiertas > 0 && <span className="badge badge-estado estado-abierta mt-2">{abiertas} abierta{abiertas > 1 ? 's' : ''}</span>}
            </Link>
          </div>
        ))}
      </div>
    );
  }

  if (presentacion === 'compacta') {
    return (
      <nav aria-label="Categorías de la edición">
        <ul className="list-unstyled d-flex flex-wrap gap-2 mb-0">
          {items.map(({ categoria: c, ruta, total, abiertas }) => (
            <li key={c.id}>
              <Link to={ruta} className="categoria-chip" aria-label={`${c.nombre}: ${contar(total, 'votación', 'votaciones')}, ${abiertas} abiertas`}>
                <IconoEntidad icono={c.icono} imagen={c.iconoImagen} className="categoria-chip-icono" />
                {c.nombre}
                <span className="badge rounded-pill text-bg-light border ms-1">{total}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  if (presentacion === 'destacada' && items.length) {
    const [primera, ...resto] = items;
    return (
      <div className="row g-3">
        <div className="col-12">
          <Tarjeta c={primera.categoria} ruta={primera.ruta} total={primera.total} abiertas={primera.abiertas} grande />
        </div>
        {resto.map(({ categoria: c, ruta, total, abiertas }) => (
          <div className="col-sm-6 col-lg-3" key={c.id}>
            <Tarjeta c={c} ruta={ruta} total={total} abiertas={abiertas} />
          </div>
        ))}
      </div>
    );
  }

  // Tarjetas (por defecto)
  return (
    <div className="row g-3">
      {items.map(({ categoria: c, ruta, total, abiertas }) => (
        <div className="col-sm-6 col-lg-4" key={c.id}>
          <Tarjeta c={c} ruta={ruta} total={total} abiertas={abiertas} />
        </div>
      ))}
    </div>
  );
}
