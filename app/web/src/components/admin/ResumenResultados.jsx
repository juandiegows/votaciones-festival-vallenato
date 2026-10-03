import IconoEntidad from '../IconoEntidad.jsx';
import EstadoBadge from '../EstadoBadge.jsx';
import TablaResponsiva from '../TablaResponsiva.jsx';

const n = (x) => x.toLocaleString('es-CO');

const estado = (v) => (v.publicada ? <EstadoBadge estado={v.estado} /> : <span className="badge text-bg-secondary">Borrador</span>);

const lider = (v) => {
  const o = v.opciones[0];
  return o && o.votos > 0 ? o : null;
};

const textoLider = (v) => {
  const o = lider(v);
  return o ? `${o.nombre} · ${o.porcentaje.toFixed(1)} %` : '—';
};

function BotonVotacion({ v, onElegir, className = '' }) {
  return (
    <button type="button" className={`btn btn-link p-0 fw-semibold text-start text-reset ${className}`} onClick={() => onElegir(v.id)} aria-label={`Ver detalle de ${v.titulo}`}>
      {v.titulo}
    </button>
  );
}

function Opciones({ v, max }) {
  return (
    <ul className="list-unstyled mb-0 mt-1">
      {v.opciones.slice(0, max).map((o, i) => (
        <li key={o.id} className="resumen-opcion">
          <span className="text-truncate">{o.nombre}</span>
          <span className="resumen-barra" aria-hidden="true"><span style={{ width: `${o.porcentaje}%` }} className={i === 0 && o.votos > 0 ? 'lider' : ''}></span></span>
          <span className="text-nowrap small"><strong>{n(o.votos)}</strong> · {o.porcentaje.toFixed(1)} %</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Resumen de toda la edición: categoría (total) › votación (total) › opciones (votos y %).
 * `vista` elige la presentación (ver SelectorVista); `onElegir(votacionId)` abre el detalle de una votación.
 */
export default function ResumenResultados({ resumen, onElegir, vista = 'tarjetas' }) {
  if (!resumen.categorias.length) {
    return <div className="card-flv p-4 text-center">Esta edición aún no tiene categorías.</div>;
  }
  const todas = resumen.categorias.flatMap((c) => c.votaciones.map((v) => ({ ...v, categoria: c })));

  if (vista === 'tabla') {
    return (
      <TablaResponsiva
        titulo="Resumen de resultados por votación"
        filas={todas}
        clave={(v) => v.id}
        nombreFila={(v) => v.titulo}
        columnas={[
          { id: 'categoria', titulo: 'Categoría', celda: (v) => v.categoria.nombre, claseTd: 'small', prioridad: 4 },
          { id: 'votacion', titulo: 'Votación', celda: (v) => <BotonVotacion v={v} onElegir={onElegir} />, minimo: '10rem', prioridad: 0 },
          { id: 'estado', titulo: 'Estado', celda: estado, prioridad: 2 },
          { id: 'lider', titulo: 'Va ganando', celda: textoLider, claseTd: 'small', prioridad: 3 },
          { id: 'votos', titulo: 'Votos', celda: (v) => n(v.totalVotos), claseTh: 'text-end', claseTd: 'text-end fw-bold', prioridad: 1 },
        ]}
      />
    );
  }

  if (vista === 'mosaico') {
    return (
      <div className="row g-2 vista-mosaico">
        {todas.map((v) => (
          <div className="col-sm-6 col-lg-4 col-xxl-3" key={v.id}>
            <article className="card-flv h-100 d-flex flex-column gap-1">
              <span className="small text-secondary-flv d-flex align-items-center gap-1">
                <IconoEntidad icono={v.categoria.icono} imagen={v.categoria.iconoImagen} className="text-rojo" />{v.categoria.nombre}
              </span>
              <BotonVotacion v={v} onElegir={onElegir} />
              <div className="d-flex justify-content-between align-items-center">
                {estado(v)}
                <span className="resumen-total">{n(v.totalVotos)}</span>
              </div>
              <Opciones v={v} max={3} />
            </article>
          </div>
        ))}
      </div>
    );
  }

  if (vista === 'lista') {
    return (
      <ul className="list-unstyled d-grid gap-2 mb-0">
        {todas.map((v) => (
          <li key={v.id} className="card-flv p-3 d-flex flex-wrap align-items-center gap-2 gap-md-3">
            <IconoEntidad icono={v.categoria.icono} imagen={v.categoria.iconoImagen} className="fs-4 text-rojo icono-lista" />
            <div className="flex-grow-1" style={{ minWidth: '14rem' }}>
              <BotonVotacion v={v} onElegir={onElegir} />
              <span className="small text-secondary-flv d-block">{v.categoria.nombre} · Va ganando: {textoLider(v)}</span>
            </div>
            {estado(v)}
            <strong className="text-nowrap">{n(v.totalVotos)} votos</strong>
          </li>
        ))}
      </ul>
    );
  }

  if (vista === 'compacta') {
    return (
      <ul className="list-unstyled lista-compacta">
        {todas.map((v) => (
          <li key={v.id}>
            <IconoEntidad icono={v.categoria.icono} imagen={v.categoria.iconoImagen} className="text-rojo" />
            <BotonVotacion v={v} onElegir={onElegir} className="flex-grow-1 text-truncate" />
            <span className="d-none d-md-inline small text-secondary-flv text-truncate">{textoLider(v)}</span>
            {estado(v)}
            <strong className="text-nowrap">{n(v.totalVotos)}</strong>
          </li>
        ))}
      </ul>
    );
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
                <BotonVotacion v={v} onElegir={onElegir} />
                <span className="d-flex align-items-center gap-2">
                  {estado(v)}
                  <strong>{n(v.totalVotos)}</strong>
                </span>
              </div>
              <Opciones v={v} />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
