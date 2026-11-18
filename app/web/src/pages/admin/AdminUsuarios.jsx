import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Paginador from '../../components/Paginador.jsx';

const esDemo = (correo) => /^(admin|votante)@festival\.test$|@demo\.festival\.test$/i.test(correo || '');
const POR_PAGINA = 25;
const normalizar = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Usuarios registrados: filtrar por rol y asignar cualquier rol a una cuenta (permiso usuarios.cambiar_rol). */
export default function AdminUsuarios() {
  const { usuarios = [], usuario: yo, roles = [], permisos = [], puede, cambiarRol } = useApp();
  const { state } = useLocation();
  const [busqueda, setBusqueda] = useState('');
  // Desde «Roles y permisos» se llega con el rol ya filtrado
  const [rol, setRol] = useState(state?.rol || '');
  const [pagina, setPagina] = useState(1);
  const [mensaje, setMensaje] = useState(null);
  const [procesando, setProcesando] = useState(null);
  // Rol elegido en el selector de cada fila, antes de aplicarlo
  const [elegidos, setElegidos] = useState({});
  const puedeCambiar = puede('usuarios.cambiar_rol');

  const nombreRol = (codigo) => roles.find((r) => r.codigo === codigo)?.nombre || usuarios.find((u) => u.rol === codigo)?.rolNombre || codigo;
  const ordenRol = (codigo) => roles.find((r) => r.codigo === codigo)?.orden ?? 99;
  const q = normalizar(busqueda.trim());
  const lista = [...usuarios]
    .filter((u) => !q || normalizar(`${u.correo} ${u.nombres} ${u.apellidos}`).includes(q))
    .filter((u) => !rol || u.rol === rol)
    .sort((a, b) => ordenRol(b.rol) - ordenRol(a.rol) || a.correo.localeCompare(b.correo));
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, paginas);
  const visibles = lista.slice((paginaActual - 1) * POR_PAGINA, paginaActual * POR_PAGINA);
  const admins = usuarios.filter((u) => u.rol === 'administrador' && u.activo !== false).length;
  // Mismas reglas que la API: solo se asignan (o quitan) roles cuyos permisos tienes; si no se conocen, decide la API
  const faltanPermisos = (r) => Array.isArray(r?.permisos) && r.permisos.some((c) => !permisos.includes(c));

  const aplicar = async (u) => {
    const nuevo = elegidos[u.id];
    if (!nuevo || nuevo === u.rol) return;
    setProcesando(u.id);
    const r = await cambiarRol(u.id, nuevo);
    setProcesando(null);
    if (r.ok) setElegidos(({ [u.id]: _, ...resto }) => resto);
    setMensaje(r.ok
      ? { tipo: 'success', texto: `${u.correo} ahora tiene el rol «${nombreRol(nuevo)}».` }
      : { tipo: 'danger', texto: r.error });
  };

  const accion = (u) => {
    if (u.id === yo?.id) return <span className="small text-secondary-flv">Tu cuenta (nadie cambia su propio rol)</span>;
    const actual = roles.find((r) => r.codigo === u.rol);
    if (faltanPermisos(actual)) {
      return <span className="small text-secondary-flv">Tiene permisos que tu rol no tiene: no puedes cambiarle el rol.</span>;
    }
    const valor = elegidos[u.id] ?? u.rol;
    const id = `u-rol-${u.id}`;
    return (
      <div className="d-flex flex-wrap justify-content-md-end align-items-center gap-2">
        <label className="visually-hidden" htmlFor={id}>Rol de {u.correo}</label>
        <select id={id} className="form-select form-select-sm w-auto" value={valor} disabled={procesando === u.id}
          onChange={(e) => setElegidos({ ...elegidos, [u.id]: e.target.value })}>
          {!roles.some((r) => r.codigo === u.rol) && <option value={u.rol}>{u.rolNombre || u.rol}</option>}
          {roles.map((r) => {
            const sinPermisos = faltanPermisos(r);
            const desactivada = u.activo === false && r.permisos?.includes('panel.ver');
            return (
              <option key={r.codigo} value={r.codigo} disabled={r.codigo !== u.rol && (sinPermisos || desactivada)}>
                {r.nombre}{sinPermisos ? ' (requiere permisos que no tienes)' : desactivada ? ' (cuenta desactivada)' : ''}
              </option>
            );
          })}
        </select>
        <button type="button" className="btn btn-sm btn-primary" disabled={valor === u.rol || procesando === u.id} onClick={() => aplicar(u)}
          aria-label={`Asignar el rol ${nombreRol(valor)} a ${u.correo}`}>
          {procesando === u.id ? 'Guardando…' : 'Asignar'}
        </button>
      </div>
    );
  };

  const paginador = (posicion) => (
    <Paginador posicion={posicion} pagina={paginaActual} paginas={paginas} onCambio={setPagina} etiqueta="usuarios"
      resumen={`${lista.length.toLocaleString('es-CO')} ${lista.length === 1 ? 'usuario' : 'usuarios'}`} />
  );

  return (
    <>
      <PageHeader
        titulo="Usuarios"
        subtitulo={`Las personas se registran solas en el sitio como votantes. ${puedeCambiar ? 'Aquí puedes asignarle a cada cuenta el rol que necesite. ' : ''}Hay ${admins} ${admins === 1 ? 'administrador activo' : 'administradores activos'}.`}
      >
        {puede('roles.ver') && (
          <Link to="/panel/roles" className="btn btn-outline-primary"><i className="bi bi-person-lock me-1" aria-hidden="true"></i>Roles y permisos</Link>
        )}
      </PageHeader>
      {mensaje && (
        <div className={`alert alert-${mensaje.tipo} alert-dismissible`} role="status">
          {mensaje.texto}
          <button type="button" className="btn-close" aria-label="Cerrar mensaje" onClick={() => setMensaje(null)}></button>
        </div>
      )}
      <div className="row g-2 align-items-end mb-3" role="search">
        <div className="col-sm-6 col-lg-5">
          <label className="form-label small" htmlFor="u-buscar">Buscar por correo o nombre</label>
          <input id="u-buscar" type="search" className="form-control" value={busqueda} placeholder="correo@ejemplo.com" onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }} />
        </div>
        <div className="col-sm-6 col-lg-4">
          <label className="form-label small" htmlFor="u-rol">Rol</label>
          <select id="u-rol" className="form-select" value={rol} onChange={(e) => { setRol(e.target.value); setPagina(1); }}>
            <option value="">Todos los roles</option>
            {roles.map((r) => <option key={r.codigo} value={r.codigo}>{r.nombre}</option>)}
          </select>
        </div>
      </div>

      {visibles.length ? (
        <>
          {paginador('arriba')}
          <div className="card-flv p-0 table-responsive">
            <table className="table align-middle mb-0 tabla-apilada">
              <caption className="visually-hidden">Usuarios registrados, página {paginaActual} de {paginas}</caption>
              <thead>
                <tr>
                  <th scope="col">Usuario</th>
                  <th scope="col">Rol</th>
                  <th scope="col">Estado</th>
                  {puedeCambiar && <th scope="col" className="text-md-end">Asignar rol</th>}
                </tr>
              </thead>
              <tbody>
                {visibles.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <span className="fw-semibold d-block">{`${u.nombres || ''} ${u.apellidos || ''}`.trim() || u.correo}</span>
                      <span className="small text-secondary-flv">{u.correo}{esDemo(u.correo) && <> · <span className="badge text-bg-light border">demostración</span></>}</span>
                    </td>
                    <td data-etiqueta="Rol">
                      {u.rol === 'votante' ? (
                        nombreRol(u.rol)
                      ) : (
                        <span className={`badge ${u.rol === 'administrador' ? 'text-bg-dark' : 'text-bg-light border'}`}>
                          <i className={`bi bi-${u.rol === 'administrador' ? 'shield-lock' : 'person-badge'} me-1`} aria-hidden="true"></i>{nombreRol(u.rol)}
                        </span>
                      )}
                    </td>
                    <td data-etiqueta="Estado" className="small">{u.activo === false ? 'Desactivada' : u.correoVerificado === false ? 'Correo sin confirmar' : 'Correo confirmado'}</td>
                    {puedeCambiar && <td data-etiqueta="Asignar rol" className="text-md-end">{accion(u)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {paginador('abajo')}
        </>
      ) : (
        <div className="card-flv p-4 text-center"><p className="mb-0">No hay usuarios que coincidan con la búsqueda.</p></div>
      )}
      <p className="small text-secondary-flv mt-3 mb-0">
        <i className="bi bi-info-circle me-1" aria-hidden="true"></i>Para darle acceso al panel a alguien, la persona se registra en el sitio y luego le asignas un rol aquí.
        Nadie cambia su propio rol, solo se asignan roles cuyos permisos tienes y siempre queda al menos un administrador activo.
      </p>
    </>
  );
}
