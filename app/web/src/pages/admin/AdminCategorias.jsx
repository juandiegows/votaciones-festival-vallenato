import { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Modal from '../../components/Modal.jsx';
import { PATRON_SLUG } from '../../utils/helpers.js';

const ICONOS = ['music-note-beamed', 'people-fill', 'stars', 'boombox-fill', 'award-fill', 'mic-fill', 'camera-fill', 'heart-fill', 'trophy-fill'];

export default function AdminCategorias() {
  const { categorias, ediciones, votaciones, guardarEntidad, eliminarEntidad, edicionActiva } = useApp();
  const [form, setForm] = useState(null);
  const [errores, setErrores] = useState({});
  const [mensaje, setMensaje] = useState(null);
  const [eliminar, setEliminar] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [mensajeFormulario, setMensajeFormulario] = useState('');

  const lista = [...categorias].sort((a, b) => a.edicionId - b.edicionId || a.orden - b.orden);

  const nueva = () => {
    abrirFormulario({ edicionId: edicionActiva?.id || ediciones[0]?.id || '', nombre: '', slug: '', descripcion: '', icono: ICONOS[0], activa: true, orden: categorias.length + 1 });
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
    const datos = { ...form, edicionId: Number(form.edicionId), orden: Number(form.orden), slug: form.slug.trim() };
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

  const abrirFormulario = (valores) => {
    setErrores({});
    setMensajeFormulario('');
    setForm(valores);
  };

  const alternar = async (c) => {
    setProcesando(true);
    const r = await guardarEntidad('categorias', { id: c.id, activa: !c.activa }, `${c.activa ? 'Desactivó' : 'Activó'} la categoría "${c.nombre}"`);
    setProcesando(false);
    if (!r.ok) return setMensaje({ tipo: 'danger', texto: r.error });
    setMensaje({ tipo: 'info', texto: `Categoría «${c.nombre}» ${c.activa ? 'desactivada: ya no se muestra al público' : 'activada'}.` });
  };

  const pedirEliminar = (c) => {
    const n = votaciones.filter((v) => v.categoriaId === c.id).length;
    if (n > 0) {
      setMensaje({ tipo: 'warning', texto: `No se puede eliminar «${c.nombre}»: tiene ${n} votación(es) asociada(s). Puedes desactivarla.` });
      return;
    }
    setEliminar(c);
  };

  return (
    <>
      <PageHeader titulo="Gestión de categorías" subtitulo="Crear, editar, activar o desactivar categorías.">
        <button className="btn btn-primary" onClick={nueva}><i className="bi bi-plus-lg me-1" aria-hidden="true"></i>Nueva categoría</button>
      </PageHeader>
      <p className="badge badge-ilustrativo rounded-pill px-3 py-2">Categorías ilustrativas – pendientes de validación con la Fundación</p>
      {mensaje && (
        <div className={`alert alert-${mensaje.tipo} alert-dismissible`} role="status">
          {mensaje.texto}
          <button type="button" className="btn-close" aria-label="Cerrar mensaje" onClick={() => setMensaje(null)}></button>
        </div>
      )}
      <div className="table-responsive card-flv">
        <table className="table table-flv table-hover align-middle mb-0">
          <caption className="visually-hidden">Listado de categorías</caption>
          <thead>
            <tr>
              <th scope="col">Orden</th>
              <th scope="col">Categoría</th>
              <th scope="col">Edición</th>
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
                  <i className={`bi bi-${c.icono} me-2 text-rojo`} aria-hidden="true"></i>
                  <strong>{c.nombre}</strong> <code className="small text-secondary-flv">/{c.slug}</code>
                  <div className="small text-secondary-flv d-none d-md-block">{c.descripcion}</div>
                </td>
                <td className="small">{ediciones.find((e) => e.id === c.edicionId)?.anio}</td>
                <td>{votaciones.filter((v) => v.categoriaId === c.id).length}</td>
                <td>
                  <div className="form-check form-switch mb-0">
                    <input className="form-check-input" type="checkbox" role="switch" id={`activa-${c.id}`} checked={c.activa} disabled={procesando} onChange={() => alternar(c)} />
                    <label className="form-check-label small" htmlFor={`activa-${c.id}`}>{c.activa ? 'Activa' : 'Inactiva'}</label>
                  </div>
                </td>
                <td className="text-end text-nowrap">
                  <button className="btn btn-sm btn-outline-primary me-1" onClick={() => abrirFormulario({ ...c, slug: c.slug || '' })} aria-label={`Editar ${c.nombre}`}>
                    <i className="bi bi-pencil" aria-hidden="true"></i>
                  </button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => pedirEliminar(c)} aria-label={`Eliminar ${c.nombre}`}>
                    <i className="bi bi-trash" aria-hidden="true"></i>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        abierto={!!form}
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
            <div className="mb-3">
              <label className="form-label" htmlFor="cat-edicion">Edición</label>
              <select id="cat-edicion" className={`form-select ${errores.edicionId ? 'is-invalid' : ''}`} value={form.edicionId} onChange={(e) => setForm({ ...form, edicionId: e.target.value })}>
                {ediciones.map((ed) => <option key={ed.id} value={ed.id}>{ed.nombre}</option>)}
              </select>
              {errores.edicionId && <div className="invalid-feedback">{errores.edicionId}</div>}
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="cat-nombre">Nombre</label>
              <input id="cat-nombre" className={`form-control ${errores.nombre ? 'is-invalid' : ''}`} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              {errores.nombre && <div className="invalid-feedback">{errores.nombre}</div>}
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="cat-slug">Identificador en la URL <span className="fw-normal text-secondary-flv">(opcional)</span></label>
              <input id="cat-slug" className={`form-control ${errores.slug ? 'is-invalid' : ''}`} value={form.slug} placeholder="se genera desde el nombre" onChange={(e) => setForm({ ...form, slug: e.target.value })} aria-describedby="cat-slug-ayuda" />
              {errores.slug ? <div className="invalid-feedback">{errores.slug}</div> : <div id="cat-slug-ayuda" className="form-text">Aparece en la dirección pública, p. ej. /{ediciones.find((ed) => ed.id === Number(form.edicionId))?.anio}/{form.slug || 'musica'}. Déjalo vacío para generarlo automáticamente.</div>}
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="cat-desc">Descripción</label>
              <textarea id="cat-desc" rows="2" className={`form-control ${errores.descripcion ? 'is-invalid' : ''}`} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })}></textarea>
              {errores.descripcion && <div className="invalid-feedback">{errores.descripcion}</div>}
            </div>
            <div className="row">
              <div className="col-7 mb-3">
                <label className="form-label" htmlFor="cat-icono">Ícono</label>
                <select id="cat-icono" className="form-select" value={form.icono} onChange={(e) => setForm({ ...form, icono: e.target.value })}>
                  {ICONOS.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div className="col-5 mb-3">
                <label className="form-label" htmlFor="cat-orden">Orden</label>
                <input id="cat-orden" type="number" min="1" className="form-control" value={form.orden} onChange={(e) => setForm({ ...form, orden: e.target.value })} />
              </div>
            </div>
            <div className="form-check form-switch">
              <input id="cat-activa" className="form-check-input" type="checkbox" role="switch" checked={form.activa} onChange={(e) => setForm({ ...form, activa: e.target.checked })} />
              <label className="form-check-label" htmlFor="cat-activa">Categoría activa (visible al público)</label>
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
