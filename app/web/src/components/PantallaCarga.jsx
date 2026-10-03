import PaginaError from '../pages/errores/PaginaError.jsx';

// Pantalla mientras se cargan los datos de la API; si falla, página de error (sin conexión o servicio caído)
export default function PantallaCarga({ error, onReintentar }) {
  if (error) {
    const sinConexion = typeof navigator !== 'undefined' && navigator.onLine === false;
    return (
      <PaginaError
        independiente
        codigo={sinConexion ? 'sin-conexion' : 503}
        mensaje={sinConexion ? undefined : 'No pudimos conectar con el sistema de votaciones. Puede estar en mantenimiento o con muchas visitas.'}
        detalle={error}
        onReintentar={onReintentar}
        acciones={
          <button type="button" className="btn btn-primary" onClick={onReintentar}>
            <i className="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Reintentar
          </button>
        }
      />
    );
  }
  return (
    <main className="min-vh-100 d-flex align-items-center justify-content-center p-4" style={{ background: 'var(--flv-crema)' }}>
      <div className="card-flv p-4 p-md-5 text-center" style={{ maxWidth: '28rem' }}>
        <div role="status" aria-live="polite">
          <span className="spinner-border text-danger" aria-hidden="true"></span>
          <p className="mt-3 mb-0 fw-semibold">Cargando votaciones…</p>
        </div>
      </div>
    </main>
  );
}
