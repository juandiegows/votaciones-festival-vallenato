const fmtHora = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit', second: '2-digit' });

/** Interruptor «En vivo» con la hora de la última actualización. */
export default function IndicadorEnVivo({ id, activo, onCambio, actualizado, cargando, onRefrescar }) {
  return (
    <div className="d-flex flex-wrap align-items-center gap-2 indicador-en-vivo">
      <div className="form-check form-switch mb-0">
        <input className="form-check-input" type="checkbox" role="switch" id={id} checked={activo} onChange={(e) => onCambio(e.target.checked)} />
        <label className="form-check-label small fw-semibold" htmlFor={id}>
          {activo && <span className="punto-en-vivo me-1" aria-hidden="true"></span>}En vivo
        </label>
      </div>
      <span className="small text-secondary-flv" aria-live="polite">
        {cargando ? 'Actualizando…' : actualizado ? `Actualizado ${fmtHora.format(actualizado)}` : ''}
      </span>
      {onRefrescar && (
        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onRefrescar} disabled={cargando} aria-label="Actualizar ahora" title="Actualizar ahora">
          <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>
        </button>
      )}
    </div>
  );
}
