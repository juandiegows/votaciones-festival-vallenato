// Pantalla mientras se cargan los datos de la API (o si no hay conexión)
export default function PantallaCarga({ error, onReintentar }) {
  return (
    <main className="min-vh-100 d-flex align-items-center justify-content-center p-4" style={{ background: 'var(--flv-crema)' }}>
      <div className="card-flv p-4 p-md-5 text-center" style={{ maxWidth: '28rem' }}>
        {error ? (
          <>
            <i className="bi bi-wifi-off display-5 text-rojo" aria-hidden="true"></i>
            <h1 className="h4 mt-3">No pudimos cargar las votaciones</h1>
            <p className="mb-4" role="alert">{error}</p>
            <button type="button" className="btn btn-primary" onClick={onReintentar}>
              <i className="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Reintentar
            </button>
          </>
        ) : (
          <div role="status" aria-live="polite">
            <span className="spinner-border text-danger" aria-hidden="true"></span>
            <p className="mt-3 mb-0 fw-semibold">Cargando votaciones…</p>
          </div>
        )}
      </div>
    </main>
  );
}
