import Avatar from '../Avatar.jsx';
import ReproductorMultimedia from '../ReproductorMultimedia.jsx';

const tieneMedio = (o) => Boolean(o.audio || o.enlaceMultimedia || o.textoAudio);

/** Entrada radio (oculta) + etiqueta; el reproductor siempre va fuera del <label>. */
function Radio({ o, marcada, deshabilitada, onElegir }) {
  return (
    <input
      type="radio"
      className="opcion-input"
      name="opcion"
      id={`opcion-${o.id}`}
      value={o.id}
      checked={marcada}
      disabled={deshabilitada}
      onChange={() => onElegir(o.id)}
    />
  );
}

const Check = ({ marcada }) => <span className="opcion-check" aria-hidden="true">{marcada && <i className="bi bi-check-lg"></i>}</span>;

const Reproductor = ({ o, className = 'reproductor-opcion', textoAbierto = false }) =>
  tieneMedio(o) ? (
    <ReproductorMultimedia audio={o.audio} enlace={o.enlaceMultimedia} textoAudio={o.textoAudio} titulo={o.nombre} className={className} textoAbierto={textoAbierto} />
  ) : null;

/**
 * Opciones de una votación en una de las 5 presentaciones que elige el administrador:
 * tarjetas, lista, mosaico, compacta y reproductor. Todas conservan la semántica radio.
 */
export default function OpcionesVotacion({ lista, presentacion = 'tarjetas', estaMarcada, deshabilitada, onElegir }) {
  const props = (o) => ({ o, marcada: estaMarcada(o), deshabilitada, onElegir });

  if (presentacion === 'lista') {
    return (
      <div className="d-grid gap-2 opciones-lista">
        {lista.map((o) => (
          <div className={tieneMedio(o) ? 'opcion-con-medio' : ''} key={o.id}>
            <Radio {...props(o)} />
            <label htmlFor={`opcion-${o.id}`} className="opcion-card">
              <Avatar nombre={o.nombre} tamano={40} />
              <span className="flex-grow-1">
                <span className="d-block fw-semibold">{o.nombre}</span>
                {o.descripcion && <span className="d-block small text-secondary-flv">{o.descripcion}</span>}
              </span>
              <Check marcada={estaMarcada(o)} />
            </label>
            <Reproductor o={o} />
          </div>
        ))}
      </div>
    );
  }

  if (presentacion === 'mosaico') {
    return (
      <div className="row g-3">
        {lista.map((o) => (
          <div className={`col-sm-6 col-xl-4 ${tieneMedio(o) ? 'opcion-con-medio' : 'd-flex'}`} key={o.id}>
            <Radio {...props(o)} />
            <label htmlFor={`opcion-${o.id}`} className="opcion-card opcion-mosaico w-100">
              <Check marcada={estaMarcada(o)} />
              <Avatar nombre={o.nombre} tamano={88} />
              <span className="d-block fw-semibold mt-2">{o.nombre}</span>
              {o.descripcion && <span className="d-block small text-secondary-flv">{o.descripcion}</span>}
            </label>
            <Reproductor o={o} />
          </div>
        ))}
      </div>
    );
  }

  if (presentacion === 'compacta') {
    const conMedio = lista.filter(tieneMedio);
    return (
      <>
        <div className="d-flex flex-wrap gap-2 opciones-compacta">
          {lista.map((o) => (
            <span key={o.id} className="position-relative">
              <Radio {...props(o)} />
              <label htmlFor={`opcion-${o.id}`} className="opcion-pill" title={o.descripcion || undefined}>
                {estaMarcada(o) ? <i className="bi bi-check-circle-fill me-1" aria-hidden="true"></i> : <i className="bi bi-circle me-1" aria-hidden="true"></i>}
                {o.nombre}
              </label>
            </span>
          ))}
        </div>
        {conMedio.length > 0 && (
          <details className="card-flv p-3 mt-3">
            <summary className="fw-semibold"><i className="bi bi-headphones me-1" aria-hidden="true"></i>Escuchar las opciones ({conMedio.length})</summary>
            <ul className="list-unstyled d-grid gap-3 mt-3 mb-0">
              {conMedio.map((o) => (
                <li key={o.id}>
                  <p className="small fw-semibold mb-1">{o.nombre}</p>
                  <Reproductor o={o} className="" />
                </li>
              ))}
            </ul>
          </details>
        )}
      </>
    );
  }

  if (presentacion === 'reproductor') {
    return (
      <ol className="list-unstyled d-grid gap-3 opciones-reproductor mb-0">
        {lista.map((o, i) => (
          <li key={o.id} className={`opcion-pista ${estaMarcada(o) ? 'marcada' : ''}`}>
            <Radio {...props(o)} />
            <label htmlFor={`opcion-${o.id}`} className="opcion-card opcion-pista-cabecera">
              <span className="opcion-pista-num" aria-hidden="true">{i + 1}</span>
              <span className="flex-grow-1">
                <span className="d-block fw-semibold">{o.nombre}</span>
                {o.descripcion && <span className="d-block small text-secondary-flv">{o.descripcion}</span>}
              </span>
              <Check marcada={estaMarcada(o)} />
            </label>
            {tieneMedio(o) && <Reproductor o={o} className="reproductor-pista" textoAbierto />}
          </li>
        ))}
      </ol>
    );
  }

  // Tarjetas (por defecto)
  return (
    <div className="row g-3">
      {lista.map((o) => (
        <div className={`col-md-6 ${tieneMedio(o) ? 'opcion-con-medio' : ''}`} key={o.id}>
          <Radio {...props(o)} />
          <label htmlFor={`opcion-${o.id}`} className="opcion-card">
            <Avatar nombre={o.nombre} />
            <span>
              <span className="d-block fw-semibold">{o.nombre}</span>
              <span className="d-block small text-secondary-flv">{o.descripcion}</span>
            </span>
            <Check marcada={estaMarcada(o)} />
          </label>
          <Reproductor o={o} />
        </div>
      ))}
    </div>
  );
}
