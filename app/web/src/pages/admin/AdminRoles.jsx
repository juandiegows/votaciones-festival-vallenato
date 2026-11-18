import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Modal from '../../components/Modal.jsx';
import TablaResponsiva from '../../components/TablaResponsiva.jsx';
import { GRUPOS_PERMISOS, TODOS_LOS_PERMISOS } from '../../data/permisos.js';
import { slugificar } from '../../utils/helpers.js';

const PATRON_CODIGO = /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
const codigoSugerido = (nombre) => slugificar(nombre).slice(0, 30).replace(/-+$/, '');

/**
 * Roles y permisos (pendiente de RF: funcionalidad nueva del panel). Cada funcionalidad es un permiso; un rol es un
 * conjunto de permisos. Mismas reglas que la API: votante y administrador tienen permisos fijos, los roles del sistema
 * no se eliminan, un rol con usuarios no se elimina, nadie edita su propio rol ni reparte permisos que no tiene.
 */
export default function AdminRoles() {
  const { roles = [], catalogoPermisos, usuario, permisos = [], puede, guardarRol, eliminarRol } = useApp();
  const catalogo = catalogoPermisos?.length ? catalogoPermisos : GRUPOS_PERMISOS;
  const totalPermisos = catalogo.reduce((n, g) => n + g.permisos.length, 0) || TODOS_LOS_PERMISOS.length;
  const gestiona = puede('roles.gestionar');
  const [form, setForm] = useState(null);
  const [errores, setErrores] = useState({});
  const [mensajeFormulario, setMensajeFormulario] = useState('');
  const [mensaje, setMensaje] = useState(null);
  const [aEliminar, setAEliminar] = useState(null);
  const [procesando, setProcesando] = useState(false);

  const lista = [...roles].sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, 'es'));

  // Por qué no se pueden cambiar los permisos de un rol (null = se pueden cambiar)
  const bloqueo = (rol) => {
    if (!gestiona) return 'Tu rol solo puede consultar los roles y sus permisos.';
    if (rol?.fijo) return `Los permisos de «${rol.nombre}» son fijos: ${rol.codigo === 'administrador' ? 'el administrador siempre los tiene todos' : 'el votante no entra al panel'}. Solo se cambian su nombre y descripción.`;
    return null;
  };
  const esPropio = (rol) => rol?.id && rol.codigo === usuario?.rol;

  const abrir = (rol) => {
    setErrores({});
    setMensajeFormulario('');
    setForm(rol
      ? { ...rol, permisos: [...(rol.permisos || [])], original: [...(rol.permisos || [])] }
      : { nombre: '', codigo: '', codigoAuto: true, descripcion: '', permisos: ['panel.ver'], original: [] });
  };

  const soloLectura = form && (!gestiona || esPropio(form));
  const permisosBloqueados = form && (soloLectura || !!bloqueo(form));
  // Un permiso que tu rol no tiene no se puede marcar ni desmarcar (la API rechazaría el cambio)
  const casillaBloqueada = (codigo) => permisosBloqueados || !permisos.includes(codigo);

  const alternar = (codigo, marcado) => setForm((f) => ({
    ...f, permisos: marcado ? [...new Set([...f.permisos, codigo])] : f.permisos.filter((c) => c !== codigo),
  }));
  const alternarGrupo = (grupo, marcar) => setForm((f) => {
    const editables = grupo.permisos.map((p) => p.codigo).filter((c) => !casillaBloqueada(c));
    const resto = f.permisos.filter((c) => !editables.includes(c));
    return { ...f, permisos: marcar ? [...resto, ...editables] : resto };
  });

  const guardar = async (e) => {
    e.preventDefault();
    if (procesando || soloLectura) return;
    const errs = {};
    if (form.nombre.trim().length < 3) errs.nombre = 'Escribe un nombre de al menos 3 caracteres.';
    if (!form.id && !PATRON_CODIGO.test(form.codigo)) errs.codigo = 'Usa solo minúsculas sin tildes, números, guiones o guion bajo (máximo 30).';
    if (!form.id && lista.some((r) => r.codigo === form.codigo)) errs.codigo = 'Ya existe un rol con este código.';
    setErrores(errs);
    if (Object.keys(errs).length) return;
    setProcesando(true);
    const datos = { nombre: form.nombre.trim(), descripcion: form.descripcion.trim() };
    if (form.id) datos.id = form.id;
    else datos.codigo = form.codigo;
    if (!form.fijo) datos.permisos = [...form.permisos].sort();
    const r = await guardarRol(datos);
    setProcesando(false);
    if (!r.ok) {
      setErrores(r.errores || {});
      setMensajeFormulario(r.error);
      return;
    }
    setMensaje({ tipo: 'success', texto: `Rol «${datos.nombre}» ${form.id ? 'actualizado' : 'creado'}.` });
    setForm(null);
  };

  const eliminar = async () => {
    setProcesando(true);
    const r = await eliminarRol(aEliminar.id);
    setProcesando(false);
    setMensaje(r.ok ? { tipo: 'success', texto: `Rol «${aEliminar.nombre}» eliminado.` } : { tipo: 'danger', texto: r.error });
    setAEliminar(null);
  };

  const numPermisos = (r) => {
    const n = r.permisos?.length ?? 0;
    if (n >= totalPermisos) return 'Todos';
    return n === 0 ? 'Ninguno' : `${n} de ${totalPermisos}`;
  };

  const insignias = (r) => (
    <>
      {r.sistema && <span className="badge text-bg-light border ms-1">Del sistema</span>}
      {r.fijo && <span className="badge text-bg-light border ms-1"><i className="bi bi-lock me-1" aria-hidden="true"></i>Permisos fijos</span>}
      {r.codigo === usuario?.rol && <span className="badge text-bg-dark ms-1">Tu rol</span>}
    </>
  );

  const acciones = (r) => {
    const editable = gestiona && !esPropio(r);
    return (
      <span className="text-nowrap">
        <button type="button" className="btn btn-sm btn-outline-primary me-1" onClick={() => abrir(r)} aria-label={`${editable ? 'Editar' : 'Ver permisos de'} ${r.nombre}`}>
          <i className={`bi bi-${editable ? 'pencil' : 'eye'} me-1`} aria-hidden="true"></i>{editable ? 'Editar' : 'Ver'}
        </button>
        {gestiona && !r.sistema && (
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setAEliminar(r)} aria-label={`Eliminar ${r.nombre}`} title="Eliminar">
            <i className="bi bi-trash" aria-hidden="true"></i>
          </button>
        )}
      </span>
    );
  };

  const sinPanel = form && !form.fijo && form.permisos.length > 0 && !form.permisos.includes('panel.ver');

  return (
    <>
      <PageHeader
        titulo="Roles y permisos"
        subtitulo="Cada funcionalidad del panel es un permiso y un rol es un conjunto de permisos. Asigna los roles a las personas en «Usuarios»."
      >
        {gestiona && (
          <button type="button" className="btn btn-primary" onClick={() => abrir(null)}>
            <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>Nuevo rol
          </button>
        )}
      </PageHeader>
      {mensaje && (
        <div className={`alert alert-${mensaje.tipo} alert-dismissible`} role="status">
          {mensaje.texto}
          <button type="button" className="btn-close" aria-label="Cerrar mensaje" onClick={() => setMensaje(null)}></button>
        </div>
      )}

      <TablaResponsiva
        titulo="Roles del sistema y roles creados en el panel"
        filas={lista}
        clave={(r) => r.codigo}
        nombreFila={(r) => r.nombre}
        vacio="No hay roles registrados."
        columnas={[
          {
            id: 'rol', titulo: 'Rol', minimo: '12rem', prioridad: 0,
            celda: (r) => (
              <>
                <strong>{r.nombre}</strong>{insignias(r)}
                <code className="small text-secondary-flv d-block">{r.codigo}</code>
              </>
            ),
          },
          { id: 'descripcion', titulo: 'Descripción', claseTd: 'small', minimo: '12rem', prioridad: 3, celda: (r) => r.descripcion || '—' },
          {
            id: 'usuarios', titulo: 'Usuarios', claseTd: 'text-nowrap', prioridad: 2,
            celda: (r) => (puede('usuarios.ver') && r.usuarios
              ? <Link to="/panel/usuarios" state={{ rol: r.codigo }} aria-label={`Ver los ${r.usuarios} usuarios con el rol ${r.nombre}`}>{r.usuarios}</Link>
              : r.usuarios ?? '—'),
          },
          { id: 'permisos', titulo: 'Permisos', claseTd: 'text-nowrap', prioridad: 4, celda: numPermisos },
          { id: 'acciones', titulo: 'Acciones', claseTh: 'text-end', claseTd: 'text-end', prioridad: 1, celda: acciones },
        ]}
      />
      <p className="small text-secondary-flv mt-3 mb-0">
        <i className="bi bi-info-circle me-1" aria-hidden="true"></i>Nadie edita su propio rol ni reparte permisos que no tiene. Los roles del sistema no se
        eliminan y un rol con usuarios tampoco: primero asígnales otro rol.
      </p>

      <Modal
        abierto={!!form}
        tamano="modal-lg"
        titulo={!form ? '' : soloLectura ? `Permisos de «${form.nombre}»` : form.id ? `Editar rol «${form.nombre}»` : 'Nuevo rol'}
        onCerrar={() => setForm(null)}
        pie={soloLectura ? (
          <button type="button" className="btn btn-outline-secondary" onClick={() => setForm(null)}>Cerrar</button>
        ) : (
          <>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setForm(null)}>Cancelar</button>
            <button type="submit" className="btn btn-primary" form="form-rol" disabled={procesando}>{procesando ? 'Guardando…' : 'Guardar'}</button>
          </>
        )}
      >
        {form && (
          <form id="form-rol" noValidate onSubmit={guardar}>
            {mensajeFormulario && <div className="alert alert-danger py-2" role="alert">{mensajeFormulario}</div>}
            {esPropio(form) && gestiona && (
              <div className="alert alert-info small" role="note">
                <i className="bi bi-person-badge me-1" aria-hidden="true"></i>Este es tu rol: no puedes editarlo. Pídeselo a otro administrador.
              </div>
            )}
            {!soloLectura && bloqueo(form) && (
              <div className="alert alert-warning small" role="note"><i className="bi bi-lock me-1" aria-hidden="true"></i>{bloqueo(form)}</div>
            )}
            <fieldset disabled={soloLectura} className="row g-3 mb-3">
              <legend className="visually-hidden">Datos del rol</legend>
              <div className="col-md-6">
                <label className="form-label" htmlFor="rol-nombre">Nombre</label>
                <input id="rol-nombre" className={`form-control ${errores.nombre ? 'is-invalid' : ''}`} value={form.nombre}
                  onChange={(e) => {
                    const nombre = e.target.value;
                    setForm((f) => ({ ...f, nombre, codigo: !f.id && f.codigoAuto ? codigoSugerido(nombre) : f.codigo }));
                  }} />
                {errores.nombre && <div className="invalid-feedback">{errores.nombre}</div>}
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="rol-codigo">Código</label>
                <input id="rol-codigo" className={`form-control ${errores.codigo ? 'is-invalid' : ''}`} value={form.codigo} disabled={!!form.id} maxLength={30}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value.trim(), codigoAuto: !e.target.value })} aria-describedby="rol-codigo-ayuda" />
                {errores.codigo
                  ? <div className="invalid-feedback">{errores.codigo}</div>
                  : <div id="rol-codigo-ayuda" className="form-text">{form.id ? 'El código de un rol no se cambia.' : 'Identificador estable del rol (se sugiere desde el nombre).'}</div>}
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="rol-descripcion">Descripción <span className="fw-normal text-secondary-flv">(opcional)</span></label>
                <textarea id="rol-descripcion" rows="2" className="form-control" value={form.descripcion || ''} onChange={(e) => setForm({ ...form, descripcion: e.target.value })}></textarea>
              </div>
            </fieldset>

            <h3 className="h6 mb-1">Permisos</h3>
            <p className="small text-secondary-flv mb-2">
              {form.permisos.length >= totalPermisos ? 'Todos los permisos' : `${form.permisos.length} de ${totalPermisos} permisos marcados`}.
              {!permisosBloqueados && permisos.length < totalPermisos && ' Los permisos que tu rol no tiene aparecen deshabilitados.'}
            </p>
            {sinPanel && (
              <div className="alert alert-warning small py-2" role="note">
                <i className="bi bi-exclamation-triangle me-1" aria-hidden="true"></i>Sin «Entrar al panel y ver el inicio» (panel.ver) las personas con este rol no entran al panel,
                aunque tenga otros permisos.
              </div>
            )}
            <div className="row g-3">
              {catalogo.map((g) => {
                const editables = g.permisos.filter((p) => !casillaBloqueada(p.codigo));
                const todos = editables.length > 0 && editables.every((p) => form.permisos.includes(p.codigo));
                return (
                  <div className="col-md-6" key={g.grupo}>
                    <fieldset className="border rounded-3 p-3 h-100">
                      <legend className="float-none w-auto h6 px-1 mb-1">{g.grupo}</legend>
                      {editables.length > 1 && (
                        <button type="button" className="btn btn-link btn-sm p-0 mb-1" onClick={() => alternarGrupo(g, !todos)}>
                          {todos ? 'Desmarcar el grupo' : 'Marcar todo el grupo'}
                        </button>
                      )}
                      {g.permisos.map((p) => {
                        const id = `perm-${p.codigo.replace(/[^a-z0-9]/gi, '-')}`;
                        return (
                          <div className="form-check" key={p.codigo}>
                            <input className="form-check-input" type="checkbox" id={id} checked={form.permisos.includes(p.codigo)}
                              disabled={casillaBloqueada(p.codigo)} onChange={(e) => alternar(p.codigo, e.target.checked)} />
                            <label className="form-check-label small" htmlFor={id}>
                              {p.descripcion} <code className="text-secondary-flv">{p.codigo}</code>
                            </label>
                          </div>
                        );
                      })}
                    </fieldset>
                  </div>
                );
              })}
            </div>
          </form>
        )}
      </Modal>

      <Modal
        abierto={!!aEliminar}
        titulo={aEliminar?.usuarios ? 'No es posible eliminar' : 'Eliminar rol'}
        onCerrar={() => setAEliminar(null)}
        pie={aEliminar?.usuarios ? (
          <>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setAEliminar(null)}>Entendido</button>
            {puede('usuarios.ver') && (
              <Link to="/panel/usuarios" state={{ rol: aEliminar.codigo }} className="btn btn-primary">Ver sus usuarios</Link>
            )}
          </>
        ) : (
          <>
            <button type="button" className="btn btn-outline-secondary" onClick={() => setAEliminar(null)}>Cancelar</button>
            <button type="button" className="btn btn-peligro" disabled={procesando} onClick={eliminar}>{procesando ? 'Eliminando…' : 'Eliminar'}</button>
          </>
        )}
      >
        {aEliminar?.usuarios ? (
          <div className="alert alert-warning mb-0" role="alert">
            <i className="bi bi-people me-1" aria-hidden="true"></i>
            El rol «{aEliminar.nombre}» tiene <strong>{aEliminar.usuarios} {aEliminar.usuarios === 1 ? 'usuario' : 'usuarios'}</strong>. Asígnales otro rol antes de eliminarlo.
          </div>
        ) : (
          <p className="mb-0">¿Eliminar el rol «{aEliminar?.nombre}»? Esta acción no se puede deshacer.</p>
        )}
      </Modal>
    </>
  );
}
