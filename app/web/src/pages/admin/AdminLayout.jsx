import { NavLink, Outlet } from 'react-router-dom';

const ENLACES = [
  { to: '/admin', label: 'Panel', icono: 'speedometer2', end: true },
  { to: '/admin/ediciones', label: 'Ediciones', icono: 'calendar3' },
  { to: '/admin/categorias', label: 'Categorías', icono: 'grid' },
  { to: '/admin/votaciones', label: 'Votaciones', icono: 'check2-square' },
  { to: '/admin/resultados', label: 'Resultados', icono: 'bar-chart' },
  { to: '/admin/auditoria', label: 'Auditoría', icono: 'clock-history' },
];

export default function AdminLayout() {
  return (
    <div className="container-xl py-4">
      <div className="row g-4">
        <div className="col-lg-2">
          <nav aria-label="Menú de administración" className="card-flv p-2 admin-nav">
            <p className="small fw-semibold text-secondary-flv px-2 pt-1 mb-1 d-none d-lg-block">Administración</p>
            <ul className="nav nav-pills flex-row flex-lg-column flex-nowrap overflow-auto gap-1">
              {ENLACES.map((e) => (
                <li className="nav-item" key={e.to}>
                  <NavLink to={e.to} end={e.end} className="nav-link">
                    <i className={`bi bi-${e.icono} me-2`} aria-hidden="true"></i>{e.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="col-lg-10">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
