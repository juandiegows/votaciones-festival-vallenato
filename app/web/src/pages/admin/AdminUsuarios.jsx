import { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import PageHeader from '../../components/PageHeader.jsx';

const esDemo = (correo) => /^(admin|votante)@festival\.test$|@demo\.festival\.test$/i.test(correo || '');
const POR_PAGINA = 25;
const normalizar = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Usuarios registrados: hacer administrador a una cuenta o devolverla a votante. */
export default function AdminUsuarios() {
  const { usuarios = [], usuario: yo, cambiarRol } = useApp();
  const [busqueda, setBusqueda] = useState('');
  const [rol, setRol] = useState('');
  const [pagina, setPagina] = useState(1);
  const [mensaje, setMensaje] = useState(null);
  const [procesando, setProcesando] = useState(null);

  const q = normalizar(busqueda.trim());
  const lista = [...usuarios]
    .filter((u) => !q || normalizar(`${u.correo} ${u.nombres} ${u.apellidos}`).includes(q))
    .filter((u) => !rol || u.rol === rol)
    .sort((a, b) => a.rol.localeCompare(b.rol) || a.correo.localeCompare(b.correo));
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  const visibles = lista.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const admins = usuarios.filter((u) => u.rol === 'administrador' && u.activo !== false).length;

  const cambiar = async (u, nuevo) => {
    setProcesando(u.id);
    const r = await cambiarRol(u.id, nuevo);
    setProcesando(null);
    setMensaje(r.ok
      ? { tipo: 'success', texto: `${u.correo} ${nuevo === 'administrador' ? 'ahora es administrador' : 'volvió a ser votante'}.` }
      : { tipo: 'danger', texto: r.error });
  };

  return (
    <>
      <PageHeader titulo="Usuarios y administradores" subtitulo={`Las personas se registran solas en el sitio. Aquí puedes hacer administrador a una cuenta registrada o devolverla a votante. Hay ${admins} ${admins === 1 ? 'administrador activo' : 'administradores activos'}.`} />
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
        <div className="col-sm-4 col-lg-3">
          <label className="form-label small" htmlFor="u-rol">Rol</label>
          <select id="u-rol" className="form-select" value={rol} onChange={(e) => { setRol(e.target.value); setPagina(1); }}>
            <option value="">Todos</option>
            <option value="administrador">Administradores</option>
            <option value="votante">Votantes</option>
          </select>
        </div>
      </div>

      {visibles.length ? (
        <div className="card-flv p-0 table-responsive">
          <table className="table align-middle mb-0 tabla-apilada">
            <caption className="visually-hidden">Usuarios registrados</caption>
            <thead><tr><th scope="col">Usuario</th><th scope="col">Rol</th><th scope="col">Estado</th><th scope="col" className="text-end">Acción</th></tr></thead>
            <tbody>
              {visibles.map((u) => (
                <tr key={u.id}>
                  <td>
                    <span className="fw-semibold d-block">{`${u.nombres || ''} ${u.apellidos || ''}`.trim() || u.correo}</span>
                    <span className="small text-secondary-flv">{u.correo}{esDemo(u.correo) && <> · <span className="badge text-bg-light border">demostración</span></>}</span>
                  </td>
                  <td data-etiqueta="Rol">{u.rol === 'administrador' ? <span className="badge text-bg-dark"><i className="bi bi-shield-lock me-1" aria-hidden="true"></i>Administrador</span> : 'Votante'}</td>
                  <td data-etiqueta="Estado" className="small">{u.activo === false ? 'Desactivada' : u.correoVerificado === false ? 'Correo sin confirmar' : 'Correo confirmado'}</td>
                  <td className="text-end">
                    {u.id === yo?.id ? (
                      <span className="small text-secondary-flv">Tu cuenta</span>
                    ) : u.rol === 'administrador' ? (
                      <button type="button" className="btn btn-sm btn-outline-danger" disabled={procesando === u.id} onClick={() => cambiar(u, 'votante')} aria-label={`Quitar el rol de administrador a ${u.correo}`}>
                        <i className="bi bi-person-dash me-1" aria-hidden="true"></i>Quitar administrador
                      </button>
                    ) : (
                      <button type="button" className="btn btn-sm btn-outline-primary" disabled={procesando === u.id || u.activo === false} onClick={() => cambiar(u, 'administrador')} aria-label={`Hacer administrador a ${u.correo}`}>
                        <i className="bi bi-person-plus me-1" aria-hidden="true"></i>Hacer administrador
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card-flv p-4 text-center"><p className="mb-0">No hay usuarios que coincidan con la búsqueda.</p></div>
      )}
      {paginas > 1 && (
        <nav className="mt-3" aria-label="Páginas de usuarios">
          <ul className="pagination pagination-sm mb-0">
            <li className={`page-item ${pagina === 1 ? 'disabled' : ''}`}><button type="button" className="page-link" onClick={() => setPagina(pagina - 1)}>Anterior</button></li>
            <li className="page-item disabled"><span className="page-link">Página {pagina} de {paginas}</span></li>
            <li className={`page-item ${pagina === paginas ? 'disabled' : ''}`}><button type="button" className="page-link" onClick={() => setPagina(pagina + 1)}>Siguiente</button></li>
          </ul>
        </nav>
      )}
      <p className="small text-secondary-flv mt-3 mb-0">
        <i className="bi bi-info-circle me-1" aria-hidden="true"></i>Para agregar un administrador nuevo, la persona se registra en el sitio y luego la buscas aquí. Nadie puede quitarse su propio rol y siempre queda al menos un administrador activo.
      </p>
    </>
  );
}
