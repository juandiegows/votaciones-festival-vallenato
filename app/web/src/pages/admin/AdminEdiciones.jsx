import { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Modal from '../../components/Modal.jsx';
import { formatearFecha } from '../../utils/helpers.js';

export default function AdminEdiciones() {
  const { ediciones, categorias, guardarEntidad, eliminarEntidad, reemplazarColeccion } = useApp();
  const [form, setForm] = useState(null);
  const [errores, setErrores] = useState({});
  const [mensaje, setMensaje] = useState(null);

  const guardar = (e) => {
    e.preventDefault();
    const errs = {};
    if (form.nombre.trim().length < 5) errs.nombre = 'Ingresa el nombre de la edición.';
    if (!/^\d{4}$/.test(String(form.anio))) errs.anio = 'Año de 4 dígitos.';
    if (!form.fechaInicio) errs.fechaInicio = 'Fecha obligatoria.';
    if (!form.fechaFin || form.fechaFin < form.fechaInicio) errs.fechaFin = 'Debe ser igual o posterior al inicio.';
    setErrores(errs);
    if (Object.keys(errs).length) return;
    const datos = { ...form, anio: Number(form.anio) };
    if (datos.estado === 'activa') {
      // Solo una edición activa a la vez
      const id = datos.id;
      const lista = ediciones.map((ed) => (ed.id === id ? { ...ed, ...datos } : { ...ed, estado: 'cerrada' }));
      const final = id ? lista : [...lista, { ...datos, id: Math.max(0, ...ediciones.map((x) => x.id)) + 1 }];
      reemplazarColeccion('ediciones', final, `${id ? 'Actualizó' : 'Creó'} la edición "${datos.nombre}" (activa)`);
    } else {
      guardarEntidad('ediciones', datos, `${datos.id ? 'Actualizó' : 'Creó'} la edición "${datos.nombre}"`);
    }
    setMensaje({ tipo: 'success', texto: `Edición «${datos.nombre}» guardada.` });
    setForm(null);
  };

  const eliminar = (ed) => {
    if (categorias.some((c) => c.edicionId === ed.id)) {
      setMensaje({ tipo: 'warning', texto: `No se puede eliminar «${ed.nombre}»: tiene categorías asociadas (RN-01).` });
      return;
    }
    eliminarEntidad('ediciones', ed.id, `Eliminó la edición "${ed.nombre}"`);
    setMensaje({ tipo: 'success', texto: `Edición «${ed.nombre}» eliminada.` });
  };

  return (
    <>
      <PageHeader titulo="Gestión de ediciones" subtitulo="Cada edición agrupa categorías y votaciones (RF-10).">
        <button className="btn btn-primary" onClick={() => { setErrores({}); setForm({ nombre: '', anio: 2028, fechaInicio: '', fechaFin: '', estado: 'cerrada' }); }}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>Nueva edición
        </button>
      </PageHeader>
      {mensaje && (
        <div className={`alert alert-${mensaje.tipo} alert-dismissible`} role="status">
          {mensaje.texto}
          <button type="button" className="btn-close" aria-label="Cerrar mensaje" onClick={() => setMensaje(null)}></button>
        </div>
      )}
      <div className="table-responsive card-flv">
        <table className="table table-flv align-middle mb-0">
          <caption className="visually-hidden">Listado de ediciones</caption>
          <thead>
            <tr>
              <th scope="col">Edición</th>
              <th scope="col">Año</th>
              <th scope="col">Fechas</th>
              <th scope="col">Categorías</th>
              <th scope="col">Estado</th>
              <th scope="col" className="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {ediciones.map((ed) => (
              <tr key={ed.id}>
                <td className="fw-semibold">{ed.nombre}</td>
                <td>{ed.anio}</td>
                <td className="small text-nowrap">{formatearFecha(ed.fechaInicio)} – {formatearFecha(ed.fechaFin)}</td>
                <td>{categorias.filter((c) => c.edicionId === ed.id).length}</td>
                <td><span className={`badge badge-estado ${ed.estado === 'activa' ? 'estado-abierta' : 'estado-cerrada'}`}>{ed.estado === 'activa' ? 'Activa' : 'Cerrada'}</span></td>
                <td className="text-end text-nowrap">
                  <button className="btn btn-sm btn-outline-primary me-1" onClick={() => { setErrores({}); setForm({ ...ed }); }} aria-label={`Editar ${ed.nombre}`}><i className="bi bi-pencil" aria-hidden="true"></i></button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => eliminar(ed)} aria-label={`Eliminar ${ed.nombre}`}><i className="bi bi-trash" aria-hidden="true"></i></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        abierto={!!form}
        titulo={form?.id ? 'Editar edición' : 'Nueva edición'}
        onCerrar={() => setForm(null)}
        pie={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setForm(null)}>Cancelar</button>
            <button className="btn btn-primary" type="submit" form="form-edicion">Guardar</button>
          </>
        }
      >
        {form && (
          <form id="form-edicion" noValidate onSubmit={guardar}>
            <div className="mb-3">
              <label className="form-label" htmlFor="e-nombre">Nombre</label>
              <input id="e-nombre" className={`form-control ${errores.nombre ? 'is-invalid' : ''}`} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Festival de la Leyenda Vallenata 2028" />
              {errores.nombre && <div className="invalid-feedback">{errores.nombre}</div>}
            </div>
            <div className="row g-3">
              <div className="col-sm-4">
                <label className="form-label" htmlFor="e-anio">Año</label>
                <input id="e-anio" type="number" className={`form-control ${errores.anio ? 'is-invalid' : ''}`} value={form.anio} onChange={(e) => setForm({ ...form, anio: e.target.value })} />
                {errores.anio && <div className="invalid-feedback">{errores.anio}</div>}
              </div>
              <div className="col-sm-4">
                <label className="form-label" htmlFor="e-ini">Fecha de inicio</label>
                <input id="e-ini" type="date" className={`form-control ${errores.fechaInicio ? 'is-invalid' : ''}`} value={form.fechaInicio} onChange={(e) => setForm({ ...form, fechaInicio: e.target.value })} />
                {errores.fechaInicio && <div className="invalid-feedback">{errores.fechaInicio}</div>}
              </div>
              <div className="col-sm-4">
                <label className="form-label" htmlFor="e-fin">Fecha de fin</label>
                <input id="e-fin" type="date" className={`form-control ${errores.fechaFin ? 'is-invalid' : ''}`} value={form.fechaFin} onChange={(e) => setForm({ ...form, fechaFin: e.target.value })} />
                {errores.fechaFin && <div className="invalid-feedback">{errores.fechaFin}</div>}
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="e-estado">Estado</label>
                <select id="e-estado" className="form-select" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} aria-describedby="e-estado-ayuda">
                  <option value="activa">Activa</option>
                  <option value="cerrada">Cerrada</option>
                </select>
                <div id="e-estado-ayuda" className="form-text">Solo puede haber una edición activa; al activar esta, las demás se cierran.</div>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
