import { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import { formatearFechaHora } from '../../utils/helpers.js';

// Registro de acciones administrativas, 50 por página
export default function AdminAuditoria() {
  const { cargarAuditoria, version } = useApp();
  const [pagina, setPagina] = useState(1);
  const [estado, setEstado] = useState({ cargando: true, registros: [], total: 0, hayMas: false, error: '' });

  useEffect(() => {
    let vigente = true;
    setEstado((e) => ({ ...e, cargando: true }));
    cargarAuditoria(pagina).then((r) => {
      if (!vigente) return;
      setEstado(r.ok ? { cargando: false, ...r, error: '' } : { cargando: false, registros: [], total: 0, hayMas: false, error: r.error });
    });
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, version]);

  const { cargando, registros, total, hayMas, error } = estado;

  return (
    <>
      <PageHeader titulo="Auditoría" subtitulo="Acciones de administración registradas por el sistema, de la más reciente a la más antigua." />
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      <div className="table-responsive card-flv">
        <table className="table table-flv align-middle mb-0">
          <caption className="visually-hidden">Registro de auditoría, página {pagina}</caption>
          <thead>
            <tr>
              <th scope="col">Fecha y hora</th>
              <th scope="col">Usuario</th>
              <th scope="col">Acción</th>
            </tr>
          </thead>
          <tbody aria-busy={cargando}>
            {registros.map((a) => (
              <tr key={a.id}>
                <td className="small text-nowrap">{formatearFechaHora(a.fechaHora)}</td>
                <td className="small text-break">{a.usuario}</td>
                <td className="small">{a.accion}</td>
              </tr>
            ))}
            {!cargando && registros.length === 0 && (
              <tr><td colSpan="3" className="text-center py-4">Aún no hay acciones registradas.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <nav className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3" aria-label="Paginación de la auditoría">
        <span className="small text-secondary-flv" aria-live="polite">
          {cargando ? 'Cargando…' : `${total.toLocaleString('es-CO')} registros · página ${pagina}`}
        </span>
        <div className="btn-group">
          <button type="button" className="btn btn-sm btn-outline-primary" disabled={pagina === 1 || cargando} onClick={() => setPagina((p) => p - 1)}>
            <i className="bi bi-chevron-left me-1" aria-hidden="true"></i>Anterior
          </button>
          <button type="button" className="btn btn-sm btn-outline-primary" disabled={!hayMas || cargando} onClick={() => setPagina((p) => p + 1)}>
            Siguiente<i className="bi bi-chevron-right ms-1" aria-hidden="true"></i>
          </button>
        </div>
      </nav>
    </>
  );
}
