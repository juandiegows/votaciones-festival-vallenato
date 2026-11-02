import { Fragment, useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { EdicionAdminProvider, useEdicionAdmin } from '../../context/EdicionAdmin.jsx';
import { useSeo } from '../../hooks/useSeo.js';

// `porEdicion`: la pantalla muestra solo los datos de la edición elegida en el selector
const GRUPOS = [
  { titulo: null, enlaces: [{ to: '/panel', label: 'Panel', icono: 'speedometer2', end: true, porEdicion: true }] },
  {
    titulo: 'Organizar',
    enlaces: [
      { to: '/panel/ediciones', label: 'Ediciones', icono: 'calendar3' },
      { to: '/panel/categorias', label: 'Categorías', icono: 'grid', porEdicion: true },
      { to: '/panel/votaciones', label: 'Votaciones', icono: 'check2-square', porEdicion: true },
    ],
  },
  {
    titulo: 'Seguimiento',
    enlaces: [
      { to: '/panel/resultados', label: 'Votos y resultados', icono: 'bar-chart', porEdicion: true },
      { to: '/panel/auditoria', label: 'Auditoría', icono: 'shield-check', porEdicion: true },
    ],
  },
  {
    titulo: 'Sitio público',
    enlaces: [
      { to: '/panel/banner', label: 'Banner de inicio', icono: 'images', porEdicion: true },
      { to: '/panel/revista', label: 'Revista', icono: 'book' },
      { to: '/panel/sitio', label: 'Contacto y redes', icono: 'telephone' },
      { to: '/panel/marca', label: 'Identidad visual', icono: 'palette' },
    ],
  },
  { titulo: 'Ajustes', enlaces: [{ to: '/panel/configuracion', label: 'Configuración', icono: 'gear', porEdicion: true }] },
];

function SelectorEdicion() {
  const { edicion, edicionId, ediciones, esActiva, setEdicionId } = useEdicionAdmin();
  if (!ediciones.length) return null;
  return (
    <div className="px-2 pb-2 mb-1 border-bottom selector-edicion-admin">
      <label htmlFor="admin-edicion" className="small fw-semibold text-secondary-flv mb-1 d-block">Edición que estás viendo</label>
      <select id="admin-edicion" className="form-select form-select-sm" value={edicionId ?? ''} onChange={(e) => setEdicionId(e.target.value)} aria-describedby="admin-edicion-ayuda">
        {ediciones.map((ed) => (
          <option key={ed.id} value={ed.id}>{ed.anio}{ed.estado === 'activa' ? ' · activa' : ''}</option>
        ))}
      </select>
      <p id="admin-edicion-ayuda" className="small mb-0 mt-1">
        {esActiva ? (
          <span className="badge badge-estado estado-abierta">Edición activa</span>
        ) : (
          <span className="badge text-bg-secondary"><i className="bi bi-archive me-1" aria-hidden="true"></i>Consultando {edicion?.anio}</span>
        )}
      </p>
    </div>
  );
}

function AvisoEdicion() {
  const { edicion, esActiva } = useEdicionAdmin();
  if (!edicion || esActiva) return null;
  return (
    <div className="alert alert-secondary small py-2" role="note">
      <i className="bi bi-archive me-1" aria-hidden="true"></i>Estás viendo <strong>{edicion.nombre}</strong>, que no es la edición activa. El público no la ve. Cámbiala en el menú.
    </div>
  );
}

export default function AdminLayout() {
  useSeo({ titulo: 'Panel de administración', indexar: false });
  const { pathname } = useLocation();
  const menuRef = useRef(null);
  // Móvil: el menú es una franja deslizable; se desplaza hasta la sección activa para que siempre se vea
  useEffect(() => {
    const lista = menuRef.current;
    const activo = lista?.querySelector('.nav-link.active');
    if (!lista || !activo || lista.scrollWidth <= lista.clientWidth) return;
    lista.scrollTo({ left: activo.offsetLeft - (lista.clientWidth - activo.offsetWidth) / 2, behavior: 'smooth' });
  }, [pathname]);
  return (
    <EdicionAdminProvider>
      <div className="container-fluid panel-ancho py-4">
        <div className="panel-admin">
          <aside className="panel-admin-menu">
            <nav aria-label="Menú de administración" className="card-flv p-2 admin-nav">
              <SelectorEdicion />
              <ul ref={menuRef} className="nav nav-pills flex-row flex-lg-column flex-nowrap overflow-auto gap-1 admin-nav-lista">
                {GRUPOS.map((grupo) => (
                  <Fragment key={grupo.titulo || 'inicio'}>
                    {grupo.titulo && <li className="admin-nav-grupo d-none d-lg-block">{grupo.titulo}</li>}
                    {grupo.enlaces.map((e) => (
                      <li className="nav-item" key={e.to}>
                        <NavLink to={e.to} end={e.end} className="nav-link" title={e.porEdicion ? 'Muestra la edición seleccionada' : undefined}>
                          <i className={`bi bi-${e.icono} me-2`} aria-hidden="true"></i>{e.label}
                        </NavLink>
                      </li>
                    ))}
                  </Fragment>
                ))}
              </ul>
            </nav>
          </aside>
          <div className="panel-admin-contenido">
            <AvisoEdicion />
            <Outlet />
          </div>
        </div>
      </div>
    </EdicionAdminProvider>
  );
}
