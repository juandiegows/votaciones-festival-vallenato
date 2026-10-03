import { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Modal from '../../components/Modal.jsx';
import { formatearFecha } from '../../utils/helpers.js';
import TablaResponsiva from '../../components/TablaResponsiva.jsx';

const MAXIMO_MB = 50;
const esPdf = (archivo) => archivo.type === 'application/pdf' || archivo.name.toLowerCase().endsWith('.pdf');
const tamano = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

// Revista institucional en PDF: el inicio muestra la primera revista activa de la lista como un libro que se hojea
export default function AdminRevista() {
  const { revistas = [], guardarEntidad, eliminarEntidad, reemplazarColeccion } = useApp();
  const [form, setForm] = useState(null);
  const [errores, setErrores] = useState({});
  const [mensaje, setMensaje] = useState(null);
  const [aEliminar, setAEliminar] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const lista = [...revistas].sort((a, b) => a.orden - b.orden || b.id - a.id);
  const enInicio = lista.find((r) => r.activa);

  const abrir = (r) => {
    setErrores({});
    setForm({ titulo: '', descripcion: '', activa: true, orden: 0, ...r, archivoPdf: null });
  };

  const ejecutar = async (accion, exito) => {
    setProcesando(true);
    const r = await accion();
    setProcesando(false);
    setMensaje(r.ok ? { tipo: 'success', texto: exito } : { tipo: 'danger', texto: r.error });
    return r;
  };

  const guardar = async (e) => {
    e.preventDefault();
    const errs = {};
    if (form.titulo.trim().length < 3) errs.titulo = 'Escribe un título de al menos 3 caracteres.';
    if (!form.id && !form.archivoPdf) errs.archivoPdf = 'Selecciona el PDF de la revista.';
    if (form.archivoPdf && !esPdf(form.archivoPdf)) errs.archivoPdf = 'Formato no permitido: sube la revista en PDF.';
    else if (form.archivoPdf && form.archivoPdf.size > MAXIMO_MB * 1024 * 1024) errs.archivoPdf = `El PDF supera el tamaño máximo de ${MAXIMO_MB} MB.`;
    setErrores(errs);
    if (Object.keys(errs).length) return;
    const datos = { ...form, titulo: form.titulo.trim(), descripcion: form.descripcion.trim(), orden: Number(form.orden) };
    if (!datos.archivoPdf) delete datos.archivoPdf;
    const r = await ejecutar(
      () => guardarEntidad('revistas', datos, `${form.id ? 'Actualizó' : 'Publicó'} la revista "${datos.titulo}"`),
      `Revista «${datos.titulo}» guardada.`
    );
    if (r.ok) setForm(null);
    else setErrores(r.errores || {});
  };

  const mover = (i, delta) => {
    const nueva = [...lista];
    [nueva[i], nueva[i + delta]] = [nueva[i + delta], nueva[i]];
    const ordenes = new Map(nueva.map((r, j) => [r.id, j + 1]));
    const todas = revistas.map((r) => ({ ...r, orden: ordenes.get(r.id) }));
    ejecutar(() => reemplazarColeccion('revistas', todas, 'Reordenó las revistas'), 'Orden actualizado.');
  };

  const errorArchivo = errores.archivoPdf || errores.archivo;

  return (
    <>
      <PageHeader titulo="Revista institucional" subtitulo="PDF que el inicio muestra como un libro que se hojea. Se publica la primera revista activa de la lista; sin revistas activas la sección no aparece.">
        <button className="btn btn-primary" onClick={() => abrir({ orden: lista.length + 1 })}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>Nueva revista
        </button>
      </PageHeader>
      {mensaje && (
        <div className={`alert alert-${mensaje.tipo} alert-dismissible`} role="status">
          {mensaje.texto}
          <button type="button" className="btn-close" aria-label="Cerrar" onClick={() => setMensaje(null)}></button>
        </div>
      )}
      <TablaResponsiva
        titulo="Revistas institucionales"
        filas={lista}
        clave={(r) => r.id}
        nombreFila={(r) => r.titulo}
        vacio="No hay revistas: el inicio no muestra la sección de la revista."
        columnas={[
          {
            id: 'revista', titulo: 'Revista', minimo: '11rem', prioridad: 0,
            celda: (r) => (
              <>
                {r.id === enInicio?.id && <span className="badge text-bg-dark me-2">En el inicio</span>}
                <strong>{r.titulo}</strong>
                {r.descripcion && <div className="small text-secondary-flv">{r.descripcion}</div>}
                <a className="small" href={r.archivo} target="_blank" rel="noopener noreferrer">
                  <i className="bi bi-file-earmark-pdf me-1" aria-hidden="true"></i>Ver PDF
                </a>
              </>
            ),
          },
          { id: 'publicada', titulo: 'Publicada', claseTd: 'small text-nowrap', prioridad: 3, celda: (r) => (r.publicadaEn ? formatearFecha(r.publicadaEn) : '—') },
          {
            id: 'estado', titulo: 'Estado', prioridad: 2,
            celda: (r) => (
              <div className="form-check form-switch mb-0">
                <input className="form-check-input" type="checkbox" role="switch" id={`revista-${r.id}`} checked={r.activa} disabled={procesando}
                  onChange={() => ejecutar(() => guardarEntidad('revistas', { id: r.id, activa: !r.activa }, `${r.activa ? 'Desactivó' : 'Activó'} la revista "${r.titulo}"`), `Revista «${r.titulo}» ${r.activa ? 'desactivada' : 'activada'}.`)} />
                <label className="form-check-label small" htmlFor={`revista-${r.id}`}>{r.activa ? 'Activa' : 'Inactiva'}</label>
              </div>
            ),
          },
          {
            id: 'acciones', titulo: 'Acciones', claseTh: 'text-end', claseTd: 'text-end text-nowrap', prioridad: 1,
            celda: (r, i) => (
              <>
                <button className="btn btn-sm btn-outline-secondary me-1" disabled={i === 0 || procesando} onClick={() => mover(i, -1)} aria-label={`Subir ${r.titulo}`}><i className="bi bi-arrow-up" aria-hidden="true"></i></button>
                <button className="btn btn-sm btn-outline-secondary me-1" disabled={i === lista.length - 1 || procesando} onClick={() => mover(i, 1)} aria-label={`Bajar ${r.titulo}`}><i className="bi bi-arrow-down" aria-hidden="true"></i></button>
                <button className="btn btn-sm btn-outline-primary me-1" onClick={() => abrir(r)} aria-label={`Editar ${r.titulo}`}><i className="bi bi-pencil" aria-hidden="true"></i></button>
                <button className="btn btn-sm btn-outline-danger" onClick={() => setAEliminar(r)} aria-label={`Eliminar ${r.titulo}`}><i className="bi bi-trash" aria-hidden="true"></i></button>
              </>
            ),
          },
        ]}
      />

      <Modal
        abierto={!!form}
        tamano="modal-lg"
        titulo={form?.id ? 'Editar revista' : 'Nueva revista'}
        onCerrar={() => setForm(null)}
        pie={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setForm(null)}>Cancelar</button>
            <button className="btn btn-primary" type="submit" form="form-revista" disabled={procesando}>{procesando ? 'Subiendo…' : 'Guardar'}</button>
          </>
        }
      >
        {form && (
          <form id="form-revista" noValidate onSubmit={guardar}>
            <div className="mb-3">
              <label className="form-label" htmlFor="r-archivo">
                Archivo PDF <span className="fw-normal text-secondary-flv">(máximo {MAXIMO_MB} MB{form.id ? '; déjalo vacío para conservar el actual' : ''})</span>
              </label>
              <input id="r-archivo" type="file" accept="application/pdf,.pdf" className={`form-control ${errorArchivo ? 'is-invalid' : ''}`}
                onChange={(e) => setForm({ ...form, archivoPdf: e.target.files[0] || null })} />
              {errorArchivo && <div className="invalid-feedback">{errorArchivo}</div>}
              {form.archivoPdf && <div className="form-text">{form.archivoPdf.name} · {tamano(form.archivoPdf.size)}</div>}
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="r-titulo">Título</label>
              <input id="r-titulo" className={`form-control ${errores.titulo ? 'is-invalid' : ''}`} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
              {errores.titulo && <div className="invalid-feedback">{errores.titulo}</div>}
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="r-descripcion">Descripción (opcional)</label>
              <textarea id="r-descripcion" rows="2" className="form-control" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            </div>
            <div className="form-check form-switch">
              <input id="r-activa" className="form-check-input" type="checkbox" role="switch" checked={form.activa} onChange={(e) => setForm({ ...form, activa: e.target.checked })} />
              <label className="form-check-label" htmlFor="r-activa">Mostrar en el inicio</label>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        abierto={!!aEliminar}
        titulo="Eliminar revista"
        onCerrar={() => setAEliminar(null)}
        pie={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setAEliminar(null)}>Cancelar</button>
            <button className="btn btn-peligro" disabled={procesando} onClick={async () => {
              await ejecutar(() => eliminarEntidad('revistas', aEliminar.id, `Eliminó la revista "${aEliminar.titulo}"`), `Revista «${aEliminar.titulo}» eliminada.`);
              setAEliminar(null);
            }}>Eliminar</button>
          </>
        }
      >
        <p className="mb-0">¿Eliminar la revista «{aEliminar?.titulo}» y su PDF?</p>
      </Modal>
    </>
  );
}
