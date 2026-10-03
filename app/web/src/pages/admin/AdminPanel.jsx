import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import EstadoBadge from '../../components/EstadoBadge.jsx';
import { formatearFechaHora } from '../../utils/helpers.js';

export default function AdminPanel() {
  const { votaciones, votos, usuarios, categorias, auditoria, edicionActiva, usuario, modo } = useApp();
  const abiertas = votaciones.filter((v) => v.publicada && v.estado === 'abierta');
  const kpis = [
    { label: 'Votaciones abiertas', valor: abiertas.length, icono: 'unlock', clase: '' },
    { label: 'Total de votos', valor: votos.length, icono: 'check2-all', clase: 'oro' },
    { label: 'Votantes registrados', valor: usuarios.filter((u) => u.rol === 'votante').length, icono: 'people', clase: 'terracota' },
    { label: 'Categorías activas', valor: categorias.filter((c) => c.activa && c.edicionId === edicionActiva?.id).length, icono: 'grid', clase: 'oscuro' },
  ];

  return (
    <>
      <PageHeader titulo="Panel de administración" subtitulo={`Hola, ${usuario.nombres}. ${edicionActiva ? `${edicionActiva.nombre}.` : 'No hay una edición activa: configura una en «Ediciones».'}`} />
      <section aria-label="Indicadores" className="row g-3 mb-4">
        {kpis.map((k) => (
          <div className="col-6 col-xl-3" key={k.label}>
            <div className={`card-flv kpi ${k.clase} p-3 h-100`}>
              <div className="d-flex justify-content-between align-items-start">
                <p className="small fw-semibold text-secondary-flv mb-2">{k.label}</p>
                <i className={`bi bi-${k.icono} fs-4 text-rojo`} aria-hidden="true"></i>
              </div>
              <p className="kpi-valor mb-0">{k.valor.toLocaleString('es-CO')}</p>
            </div>
          </div>
        ))}
      </section>

      <div className="row g-4">
        <div className="col-xl-7">
          <section className="card-flv p-3 p-md-4 h-100" aria-labelledby="titulo-auditoria">
            <h2 id="titulo-auditoria" className="h5"><i className="bi bi-clock-history me-1" aria-hidden="true"></i>Actividad reciente <span className="small fw-normal text-secondary-flv">({modo === 'api' ? 'auditoría' : 'auditoría simulada'})</span></h2>
            <ul className="list-group list-group-flush">
              {auditoria.slice(0, 8).map((a) => (
                <li className="list-group-item px-0" key={a.id}>
                  <p className="mb-0 small fw-semibold">{a.accion}</p>
                  <p className="mb-0 small text-secondary-flv">{formatearFechaHora(a.fechaHora)} · {a.usuario}</p>
                </li>
              ))}
            </ul>
            <Link to="/admin/auditoria" className="enlace-mas d-inline-block mt-2">Ver toda la auditoría <i className="bi bi-arrow-right" aria-hidden="true"></i></Link>
          </section>
        </div>
        <div className="col-xl-5">
          <section className="card-flv p-3 p-md-4 mb-4" aria-labelledby="titulo-accesos">
            <h2 id="titulo-accesos" className="h5">Accesos rápidos</h2>
            <div className="d-grid gap-2">
              <Link className="btn btn-primary text-start" to="/admin/votaciones"><i className="bi bi-plus-circle me-2" aria-hidden="true"></i>Crear o gestionar votaciones</Link>
              <Link className="btn btn-outline-primary text-start" to="/admin/categorias"><i className="bi bi-grid me-2" aria-hidden="true"></i>Gestionar categorías</Link>
              <Link className="btn btn-outline-primary text-start" to="/admin/resultados"><i className="bi bi-bar-chart me-2" aria-hidden="true"></i>Consultar resultados y exportar CSV</Link>
              <Link className="btn btn-outline-primary text-start" to="/admin/ediciones"><i className="bi bi-calendar3 me-2" aria-hidden="true"></i>Gestionar ediciones</Link>
            </div>
          </section>
          <section className="card-flv p-3 p-md-4" aria-labelledby="titulo-abiertas">
            <h2 id="titulo-abiertas" className="h5">Votaciones abiertas ahora</h2>
            <ul className="list-unstyled mb-0">
              {abiertas.map((v) => (
                <li key={v.id} className="d-flex justify-content-between align-items-center gap-2 py-2 border-bottom">
                  <span className="small fw-semibold">{v.titulo}</span>
                  <span className="d-flex align-items-center gap-2">
                    <span className="small text-nowrap">{votos.filter((x) => x.votacionId === v.id).length} votos</span>
                    <EstadoBadge estado={v.estado} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
