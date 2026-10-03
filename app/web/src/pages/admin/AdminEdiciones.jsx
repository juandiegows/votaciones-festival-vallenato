import { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Modal from '../../components/Modal.jsx';
import SelectorVista, { useVistaGuardada } from '../../components/SelectorVista.jsx';
import { formatearFecha } from '../../utils/helpers.js';
import { PRESENTACIONES_CATEGORIAS, presentacionCategorias } from '../../data/presentaciones.js';

export default function AdminEdiciones() {
  const { ediciones, categorias, guardarEntidad, eliminarEntidad, reemplazarColeccion } = useApp();
  const [form, setForm] = useState(null);
  const [errores, setErrores] = useState({});
  const [mensaje, setMensaje] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [mensajeFormulario, setMensajeFormulario] = useState('');
  const [vista, setVista] = useVistaGuardada('ediciones', 'tabla');
  const siguienteAnio = Math.max(new Date().getFullYear(), ...ediciones.map((ed) => ed.anio)) + 1;

  const abrirFormulario = (valores) => {
    setErrores({});
    setMensajeFormulario('');
    setForm(valores);
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (procesando) return;
    const errs = {};
    if (form.nombre.trim().length < 5) errs.nombre = 'Ingresa el nombre de la edición.';
    if (!/^\d{4}$/.test(String(form.anio))) errs.anio = 'Año de 4 dígitos.';
    if (!form.fechaInicio) errs.fechaInicio = 'Fecha obligatoria.';
    if (!form.fechaFin || form.fechaFin < form.fechaInicio) errs.fechaFin = 'Debe ser igual o posterior al inicio.';
    setErrores(errs);
    if (Object.keys(errs).length) return;
    const datos = { ...form, anio: Number(form.anio) };
    setProcesando(true);
    let r;
    if (datos.estado === 'activa') {
      // Solo una edición activa a la vez: al activar esta, las demás se cierran
      const id = datos.id;
      const lista = ediciones.map((ed) => (ed.id === id ? { ...ed, ...datos } : { ...ed, estado: 'cerrada' }));
      const final = id ? lista : [...lista, { ...datos, id: Math.max(0, ...ediciones.map((x) => x.id)) + 1 }];
      r = await reemplazarColeccion('ediciones', final, `${id ? 'Actualizó' : 'Creó'} la edición "${datos.nombre}" (activa)`);
    } else {
      r = await guardarEntidad('ediciones', datos, `${datos.id ? 'Actualizó' : 'Creó'} la edición "${datos.nombre}"`);
    }
    setProcesando(false);
    if (!r.ok) {
      setErrores(r.errores || {});
      setMensajeFormulario(r.error);
      return;
    }
    setMensaje({ tipo: 'success', texto: `Edición «${datos.nombre}» guardada.` });
    setForm(null);
  };

  const eliminar = async (ed) => {
    if (categorias.some((c) => c.edicionId === ed.id)) {
      setMensaje({ tipo: 'warning', texto: `No se puede eliminar «${ed.nombre}»: tiene categorías asociadas.` });
      return;
    }
    setProcesando(true);
    const r = await eliminarEntidad('ediciones', ed.id, `Eliminó la edición "${ed.nombre}"`);
    setProcesando(false);
    setMensaje(r.ok ? { tipo: 'success', texto: `Edición «${ed.nombre}» eliminada.` } : { tipo: 'danger', texto: r.error });
  };

  const numCategorias = (id) => categorias.filter((c) => c.edicionId === id).length;
  const fechas = (ed) => `${formatearFecha(ed.fechaInicio)} – ${formatearFecha(ed.fechaFin)}`;
  const presentacion = (ed) => (
    <><i className={`bi bi-${presentacionCategorias(ed.presentacionCategorias).icono} me-1 text-rojo`} aria-hidden="true"></i>{presentacionCategorias(ed.presentacionCategorias).etiqueta}</>
  );
  const estado = (ed) => (
    <span className={`badge badge-estado ${ed.estado === 'activa' ? 'estado-abierta' : 'estado-cerrada'}`}>{ed.estado === 'activa' ? 'Activa' : 'Cerrada'}</span>
  );
  const acciones = (ed) => (
    <span className="text-nowrap">
      <button className="btn btn-sm btn-outline-primary me-1" onClick={() => abrirFormulario({ ...ed, presentacionCategorias: ed.presentacionCategorias || 'tarjetas' })} aria-label={`Editar ${ed.nombre}`} title="Editar"><i className="bi bi-pencil" aria-hidden="true"></i></button>
      <button className="btn btn-sm btn-outline-danger" disabled={procesando} onClick={() => eliminar(ed)} aria-label={`Eliminar ${ed.nombre}`} title="Eliminar"><i className="bi bi-trash" aria-hidden="true"></i></button>
    </span>
  );

  return (
    <>
      <PageHeader titulo="Gestión de ediciones" subtitulo="Cada edición agrupa categorías y votaciones.">
        <button className="btn btn-primary" onClick={() => abrirFormulario({ nombre: `Festival de la Leyenda Vallenata ${siguienteAnio}`, anio: siguienteAnio, fechaInicio: '', fechaFin: '', estado: 'cerrada', presentacionCategorias: 'tarjetas' })}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>Nueva edición
        </button>
      </PageHeader>
      {mensaje && (
        <div className={`alert alert-${mensaje.tipo} alert-dismissible`} role="status">
          {mensaje.texto}
          <button type="button" className="btn-close" aria-label="Cerrar mensaje" onClick={() => setMensaje(null)}></button>
        </div>
      )}
      <div className="d-flex justify-content-between align-items-center gap-2 mb-2">
        <span className="small text-secondary-flv">{ediciones.length} {ediciones.length === 1 ? 'edición' : 'ediciones'}</span>
        <SelectorVista valor={vista} onCambio={setVista} />
      </div>

      {ediciones.length === 0 && (
        <div className="card-flv p-4 text-center">
          <i className="bi bi-inbox fs-1 text-secondary" aria-hidden="true"></i>
          <p className="mb-0">Aún no hay ediciones registradas.</p>
        </div>
      )}

      {ediciones.length > 0 && vista === 'tabla' && (
        <div className="table-responsive card-flv">
          <table className="table table-flv align-middle mb-0">
            <caption className="visually-hidden">Listado de ediciones</caption>
            <thead>
              <tr>
                <th scope="col">Edición</th>
                <th scope="col">Año</th>
                <th scope="col">Fechas</th>
                <th scope="col">Categorías</th>
                <th scope="col">Presentación</th>
                <th scope="col">Estado</th>
                <th scope="col" className="text-end">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ediciones.map((ed) => (
                <tr key={ed.id}>
                  <td className="fw-semibold">{ed.nombre}</td>
                  <td>{ed.anio}</td>
                  <td className="small text-nowrap">{fechas(ed)}</td>
                  <td>{numCategorias(ed.id)}</td>
                  <td className="small text-nowrap">{presentacion(ed)}</td>
                  <td>{estado(ed)}</td>
                  <td className="text-end">{acciones(ed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ediciones.length > 0 && vista === 'tarjetas' && (
        <div className="row g-3">
          {ediciones.map((ed) => (
            <div className="col-md-6 col-xl-4" key={ed.id}>
              <article className="card-flv h-100 p-3 d-flex flex-column">
                <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                  <div>
                    <h2 className="h6 mb-0">{ed.nombre}</h2>
                    <span className="small text-secondary-flv"><i className="bi bi-calendar-event me-1" aria-hidden="true"></i>{fechas(ed)}</span>
                  </div>
                  {estado(ed)}
                </div>
                <p className="small mb-1">{numCategorias(ed.id)} categorías · Año {ed.anio}</p>
                <p className="small mb-2 flex-grow-1">{presentacion(ed)}</p>
                <div className="border-top pt-2 text-end">{acciones(ed)}</div>
              </article>
            </div>
          ))}
        </div>
      )}

      {ediciones.length > 0 && vista === 'lista' && (
        <ul className="list-unstyled d-grid gap-2 mb-0">
          {ediciones.map((ed) => (
            <li key={ed.id} className="card-flv p-3 d-flex flex-wrap align-items-center gap-2 gap-md-3">
              <span className="icono-circulo icono-sm"><i className="bi bi-calendar-event" aria-hidden="true"></i></span>
              <div className="flex-grow-1" style={{ minWidth: '14rem' }}>
                <h2 className="h6 mb-0">{ed.nombre}</h2>
                <span className="small text-secondary-flv">{fechas(ed)} · {numCategorias(ed.id)} categorías</span>
              </div>
              {estado(ed)}
              {acciones(ed)}
            </li>
          ))}
        </ul>
      )}

      {ediciones.length > 0 && vista === 'mosaico' && (
        <div className="row g-2 vista-mosaico">
          {ediciones.map((ed) => (
            <div className="col-6 col-md-4 col-xl-3" key={ed.id}>
              <article className="card-flv h-100 d-flex flex-column align-items-center text-center gap-1">
                <span className="resumen-total">{ed.anio}</span>
                {estado(ed)}
                <span className="small text-secondary-flv flex-grow-1">{numCategorias(ed.id)} categorías</span>
                <div className="border-top pt-2 w-100">{acciones(ed)}</div>
              </article>
            </div>
          ))}
        </div>
      )}

      {ediciones.length > 0 && vista === 'compacta' && (
        <ul className="list-unstyled lista-compacta">
          {ediciones.map((ed) => (
            <li key={ed.id}>
              <span className="fw-bold">{ed.anio}</span>
              <span className="flex-grow-1 text-truncate">{ed.nombre}</span>
              <span className="d-none d-md-inline small text-secondary-flv text-nowrap">{fechas(ed)}</span>
              {estado(ed)}
              {acciones(ed)}
            </li>
          ))}
        </ul>
      )}

      <Modal
        abierto={!!form}
        titulo={form?.id ? 'Editar edición' : 'Nueva edición'}
        onCerrar={() => setForm(null)}
        pie={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setForm(null)}>Cancelar</button>
            <button className="btn btn-primary" type="submit" form="form-edicion" disabled={procesando}>{procesando ? 'Guardando…' : 'Guardar'}</button>
          </>
        }
      >
        {form && (
          <form id="form-edicion" noValidate onSubmit={guardar}>
            {mensajeFormulario && <div className="alert alert-danger py-2" role="alert">{mensajeFormulario}</div>}
            <div className="mb-3">
              <label className="form-label" htmlFor="e-nombre">Nombre</label>
              <input id="e-nombre" className={`form-control ${errores.nombre ? 'is-invalid' : ''}`} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder={`Festival de la Leyenda Vallenata ${siguienteAnio}`} />
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
              <div className="col-12">
                <label className="form-label" htmlFor="e-presentacion">Presentación de categorías al público</label>
                <select id="e-presentacion" className="form-select" value={form.presentacionCategorias} onChange={(e) => setForm({ ...form, presentacionCategorias: e.target.value })} aria-describedby="e-presentacion-ayuda">
                  {PRESENTACIONES_CATEGORIAS.map((p) => <option key={p.valor} value={p.valor}>{p.etiqueta}</option>)}
                </select>
                <div id="e-presentacion-ayuda" className="form-text">
                  <i className={`bi bi-${presentacionCategorias(form.presentacionCategorias).icono} me-1`} aria-hidden="true"></i>
                  {presentacionCategorias(form.presentacionCategorias).descripcion}
                </div>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
