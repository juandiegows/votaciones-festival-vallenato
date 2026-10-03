import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import { useEdicionAdmin } from '../../context/EdicionAdmin.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Modal from '../../components/Modal.jsx';
import IconoEntidad from '../../components/IconoEntidad.jsx';
import SelectorIcono from '../../components/SelectorIcono.jsx';
import SelectorVista, { useVistaGuardada } from '../../components/SelectorVista.jsx';
import { PATRON_SLUG } from '../../utils/helpers.js';

const normalizar = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export default function AdminCategorias() {
  const { guardarEntidad, eliminarEntidad } = useApp();
  const { edicion, ediciones, categorias, votaciones } = useEdicionAdmin();
  const [form, setForm] = useState(null);
  const [errores, setErrores] = useState({});
  const [mensaje, setMensaje] = useState(null);
  const [eliminar, setEliminar] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [mensajeFormulario, setMensajeFormulario] = useState('');
  const [vista, setVista] = useVistaGuardada('categorias', 'tabla');
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');

  const numVotaciones = (id) => votaciones.filter((v) => v.categoriaId === id).length;
  const numAbiertas = (id) => votaciones.filter((v) => v.categoriaId === id && v.publicada && v.estado === 'abierta').length;

  const q = normalizar(busqueda.trim());
  const lista = [...categorias]
    .filter((c) => !q || normalizar(`${c.nombre} ${c.descripcion} ${c.slug}`).includes(q))
    .filter((c) => !filtroEstado || (filtroEstado === 'activa' ? c.activa : !c.activa))
    .sort((a, b) => a.orden - b.orden);

  const abrirFormulario = (valores) => {
    setErrores({});
    setMensajeFormulario('');
    setForm(valores);
  };

  const nueva = () => {
    abrirFormulario({
      edicionId: edicion?.id || ediciones[0]?.id || '', nombre: '', slug: '', descripcion: '', icono: 'music-note-beamed',
      iconoImagen: '', archivoIcono: null, quitarIcono: false, activa: true, orden: categorias.length + 1,
    });
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (procesando) return;
    const errs = {};
    if (form.nombre.trim().length < 3) errs.nombre = 'El nombre debe tener al menos 3 caracteres.';
    if (form.slug && !PATRON_SLUG.test(form.slug)) errs.slug = 'Usa solo minúsculas sin tildes, números y guiones (p. ej. «musica»).';
    if (!form.descripcion.trim()) errs.descripcion = 'La descripción es obligatoria.';
    if (!form.edicionId) errs.edicionId = 'Toda categoría debe pertenecer a una edición.';
    setErrores(errs);
    if (Object.keys(errs).length) return;
    // eslint-disable-next-line no-unused-vars
    const { archivoIcono, quitarIcono, iconoImagen, ...resto } = form;
    const datos = { ...resto, edicionId: Number(form.edicionId), orden: Number(form.orden), slug: form.slug.trim() };
    if (archivoIcono) datos.archivoIcono = archivoIcono;
    else if (quitarIcono) datos.quitarIcono = true;
    setProcesando(true);
    const r = await guardarEntidad('categorias', datos, `${form.id ? 'Actualizó' : 'Creó'} la categoría "${form.nombre}"`);
    setProcesando(false);
    if (!r.ok) {
      setErrores(r.errores || {});
      setMensajeFormulario(r.error);
      return;
    }
    setMensaje({ tipo: 'success', texto: `Categoría «${form.nombre}» ${form.id ? 'actualizada' : 'creada'} correctamente.` });
    setForm(null);
  };

  const alternar = async (c) => {
    setProcesando(true);
    const r = await guardarEntidad('categorias', { id: c.id, activa: !c.activa }, `${c.activa ? 'Desactivó' : 'Activó'} la categoría "${c.nombre}"`);
    setProcesando(false);
    if (!r.ok) return setMensaje({ tipo: 'danger', texto: r.error });
    setMensaje({ tipo: 'info', texto: `Categoría «${c.nombre}» ${c.activa ? 'desactivada: ya no se muestra al público' : 'activada'}.` });
  };

  const pedirEliminar = (c) => {
    const n = numVotaciones(c.id);
    if (n > 0) {
      setMensaje({ tipo: 'warning', texto: `No se puede eliminar «${c.nombre}»: tiene ${n} votación(es) asociada(s). Puedes desactivarla.` });
      return;
    }
    setEliminar(c);
  };

  const editar = (c) => abrirFormulario({ ...c, slug: c.slug || '', iconoImagen: c.iconoImagen || '', archivoIcono: null, quitarIcono: false });

  const interruptor = (c) => (
    <div className="form-check form-switch mb-0">
      <input className="form-check-input" type="checkbox" role="switch" id={`activa-${vista}-${c.id}`} checked={c.activa} disabled={procesando} onChange={() => alternar(c)} />
      <label className="form-check-label small" htmlFor={`activa-${vista}-${c.id}`}>{c.activa ? 'Activa' : 'Inactiva'}</label>
    </div>
  );

  const acciones = (c) => (
    <span className="text-nowrap">
      <button className="btn btn-sm btn-outline-primary me-1" onClick={() => editar(c)} aria-label={`Editar ${c.nombre}`} title="Editar">
        <i className="bi bi-pencil" aria-hidden="true"></i>
      </button>
      <button className="btn btn-sm btn-outline-danger" onClick={() => pedirEliminar(c)} aria-label={`Eliminar ${c.nombre}`} title="Eliminar">
        <i className="bi bi-trash" aria-hidden="true"></i>
      </button>
    </span>
  );

  const resumenVotaciones = (c) => {
    const n = numVotaciones(c.id);
    const a = numAbiertas(c.id);
    return (
      <span className="small">
        <Link to="/panel/votaciones" state={{ categoriaId: c.id }} className="text-reset">{n} {n === 1 ? 'votación' : 'votaciones'}</Link>
        {a > 0 && <span className="badge badge-estado estado-abierta ms-1">{a} abierta{a > 1 ? 's' : ''}</span>}
      </span>
    );
  };

  return (
    <>
      <PageHeader titulo="Gestión de categorías" subtitulo={edicion ? `${edicion.nombre} · Crear, editar, activar o desactivar categorías.` : 'Crear, editar, activar o desactivar categorías.'}>
        <button className="btn btn-primary" onClick={nueva} disabled={!edicion}><i className="bi bi-plus-lg me-1" aria-hidden="true"></i>Nueva categoría</button>
      </PageHeader>
      {!edicion && (
        <div className="alert alert-warning" role="alert">
          No hay ediciones registradas. <Link to="/panel/ediciones" className="alert-link">Crea una edición</Link> para agregar categorías.
        </div>
      )}
      <p className="badge badge-ilustrativo rounded-pill px-3 py-2">Categorías ilustrativas – pendientes de validación con la Fundación</p>
      {mensaje && (
        <div className={`alert alert-${mensaje.tipo} alert-dismissible`} role="status">
          {mensaje.texto}
          <button type="button" className="btn-close" aria-label="Cerrar mensaje" onClick={() => setMensaje(null)}></button>
        </div>
      )}

      <div className="card-flv p-3 mb-3">
        <div className="row g-2 align-items-end">
          <div className="col-md-6">
            <label htmlFor="cat-buscar" className="form-label small mb-1">Buscar</label>
            <input id="cat-buscar" type="search" className="form-control form-control-sm" placeholder="Nombre, descripción o URL" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
          <div className="col-sm-6 col-md-3">
            <label htmlFor="cat-f-estado" className="form-label small mb-1">Estado</label>
            <select id="cat-f-estado" className="form-select form-select-sm" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
              <option value="">Todas</option>
              <option value="activa">Activas</option>
              <option value="inactiva">Inactivas</option>
            </select>
          </div>
          <div className="col-sm-6 col-md-3 text-sm-end">
            <SelectorVista valor={vista} onCambio={setVista} />
          </div>
        </div>
      </div>
      <p className="visually-hidden" aria-live="polite">{lista.length} categorías mostradas</p>

      {lista.length === 0 && (
        <div className="card-flv p-4 text-center">
          <i className="bi bi-inbox fs-1 text-secondary" aria-hidden="true"></i>
          <p className="mb-0">{categorias.length ? 'No hay categorías con esos filtros.' : 'Esta edición aún no tiene categorías.'}</p>
        </div>
      )}

      {lista.length > 0 && vista === 'tabla' && (
        <div className="table-responsive card-flv">
          <table className="table table-flv table-hover align-middle mb-0">
            <caption className="visually-hidden">Listado de categorías</caption>
            <thead>
              <tr>
                <th scope="col">Orden</th>
                <th scope="col">Categoría</th>
                <th scope="col">Votaciones</th>
                <th scope="col">Estado</th>
                <th scope="col" className="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => (
                <tr key={c.id}>
                  <td>{c.orden}</td>
                  <td>
                    <span className="d-flex align-items-center gap-2">
                      <span className="icono-circulo icono-sm"><IconoEntidad icono={c.icono} imagen={c.iconoImagen} /></span>
                      <span>
                        <strong>{c.nombre}</strong> <code className="small text-secondary-flv">/{c.slug}</code>
                        <span className="small text-secondary-flv d-none d-md-block">{c.descripcion}</span>
                      </span>
                    </span>
                  </td>
                  <td>{resumenVotaciones(c)}</td>
                  <td>{interruptor(c)}</td>
                  <td className="text-end">{acciones(c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lista.length > 0 && vista === 'tarjetas' && (
        <div className="row g-3">
          {lista.map((c) => (
            <div className="col-sm-6 col-xl-4" key={c.id}>
              <article className={`card-flv h-100 p-3 d-flex flex-column ${c.activa ? '' : 'inactiva'}`}>
                <div className="d-flex align-items-center gap-3 mb-2">
                  <span className="icono-circulo"><IconoEntidad icono={c.icono} imagen={c.iconoImagen} /></span>
                  <div className="flex-grow-1">
                    <h2 className="h6 mb-0">{c.nombre}</h2>
                    <code className="small text-secondary-flv">/{c.slug}</code>
                  </div>
                  <span className="badge text-bg-light border" title="Orden">#{c.orden}</span>
                </div>
                <p className="small mb-2 flex-grow-1">{c.descripcion}</p>
                <div className="mb-2">{resumenVotaciones(c)}</div>
                <div className="d-flex justify-content-between align-items-center gap-2 border-top pt-2">
                  {interruptor(c)}
                  {acciones(c)}
                </div>
              </article>
            </div>
          ))}
        </div>
      )}

      {lista.length > 0 && vista === 'lista' && (
        <ul className="list-group card-flv">
          {lista.map((c) => (
            <li key={c.id} className="list-group-item d-flex flex-wrap align-items-center gap-3 py-2">
              <span className="fw-bold text-secondary-flv">{c.orden}</span>
              <IconoEntidad icono={c.icono} imagen={c.iconoImagen} className="fs-4 text-rojo icono-lista" />
              <span className="flex-grow-1 fw-semibold">{c.nombre}</span>
              {resumenVotaciones(c)}
              {interruptor(c)}
              {acciones(c)}
            </li>
          ))}
        </ul>
      )}

      <Modal
        abierto={!!form}
        tamano="modal-lg"
        titulo={form?.id ? 'Editar categoría' : 'Nueva categoría'}
        onCerrar={() => setForm(null)}
        pie={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setForm(null)}>Cancelar</button>
            <button className="btn btn-primary" type="submit" form="form-categoria" disabled={procesando}>{procesando ? 'Guardando…' : 'Guardar'}</button>
          </>
        }
      >
        {form && (
          <form id="form-categoria" noValidate onSubmit={guardar}>
            {mensajeFormulario && <div className="alert alert-danger py-2" role="alert">{mensajeFormulario}</div>}
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label" htmlFor="cat-edicion">Edición</label>
                <select id="cat-edicion" className={`form-select ${errores.edicionId ? 'is-invalid' : ''}`} value={form.edicionId} onChange={(e) => setForm({ ...form, edicionId: e.target.value })}>
                  {ediciones.map((ed) => <option key={ed.id} value={ed.id}>{ed.nombre}</option>)}
                </select>
                {errores.edicionId && <div className="invalid-feedback">{errores.edicionId}</div>}
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="cat-nombre">Nombre</label>
                <input id="cat-nombre" className={`form-control ${errores.nombre ? 'is-invalid' : ''}`} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
                {errores.nombre && <div className="invalid-feedback">{errores.nombre}</div>}
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="cat-slug">Identificador en la URL <span className="fw-normal text-secondary-flv">(opcional)</span></label>
                <input id="cat-slug" className={`form-control ${errores.slug ? 'is-invalid' : ''}`} value={form.slug} placeholder="se genera desde el nombre" onChange={(e) => setForm({ ...form, slug: e.target.value })} aria-describedby="cat-slug-ayuda" />
                {errores.slug ? <div className="invalid-feedback">{errores.slug}</div> : <div id="cat-slug-ayuda" className="form-text">Aparece en la dirección pública, p. ej. /{ediciones.find((ed) => ed.id === Number(form.edicionId))?.anio}/{form.slug || 'musica'}. Déjalo vacío para generarlo automáticamente.</div>}
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="cat-desc">Descripción</label>
                <textarea id="cat-desc" rows="2" className={`form-control ${errores.descripcion ? 'is-invalid' : ''}`} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })}></textarea>
                {errores.descripcion && <div className="invalid-feedback">{errores.descripcion}</div>}
              </div>
              <div className="col-12">
                <SelectorIcono
                  icono={form.icono}
                  iconoImagen={form.iconoImagen}
                  archivoIcono={form.archivoIcono}
                  quitarIcono={form.quitarIcono}
                  onCambio={(parcial) => setForm((f) => ({ ...f, ...parcial }))}
                />
                {errores.iconoImagen && <div className="invalid-feedback d-block">{errores.iconoImagen}</div>}
              </div>
              <div className="col-sm-4">
                <label className="form-label" htmlFor="cat-orden">Orden</label>
                <input id="cat-orden" type="number" min="1" className="form-control" value={form.orden} onChange={(e) => setForm({ ...form, orden: e.target.value })} />
              </div>
              <div className="col-sm-8 d-flex align-items-end">
                <div className="form-check form-switch mb-2">
                  <input id="cat-activa" className="form-check-input" type="checkbox" role="switch" checked={form.activa} onChange={(e) => setForm({ ...form, activa: e.target.checked })} />
                  <label className="form-check-label" htmlFor="cat-activa">Categoría activa (visible al público)</label>
                </div>
              </div>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        abierto={!!eliminar}
        titulo="Eliminar categoría"
        onCerrar={() => setEliminar(null)}
        pie={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setEliminar(null)}>Cancelar</button>
            <button
              className="btn btn-peligro"
              disabled={procesando}
              onClick={async () => {
                setProcesando(true);
                const r = await eliminarEntidad('categorias', eliminar.id, `Eliminó la categoría "${eliminar.nombre}"`);
                setProcesando(false);
                setMensaje(r.ok ? { tipo: 'success', texto: `Categoría «${eliminar.nombre}» eliminada.` } : { tipo: 'danger', texto: r.error });
                setEliminar(null);
              }}
            >
              Eliminar
            </button>
          </>
        }
      >
        <p className="mb-0">¿Seguro que deseas eliminar la categoría «{eliminar?.nombre}»? Esta acción no se puede deshacer.</p>
      </Modal>
    </>
  );
}
