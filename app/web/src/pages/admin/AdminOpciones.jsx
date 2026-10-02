import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Modal from '../../components/Modal.jsx';
import Avatar from '../../components/Avatar.jsx';
import EstadoBadge from '../../components/EstadoBadge.jsx';
import NoEncontrado from '../NoEncontrado.jsx';
import ReproductorMultimedia from '../../components/ReproductorMultimedia.jsx';
import { validarEnlaceMultimedia } from '../../utils/helpers.js';

export default function AdminOpciones() {
  const { id } = useParams();
  const { votaciones, opciones, votos, categorias, guardarEntidad, eliminarEntidad, reemplazarColeccion } = useApp();
  const [form, setForm] = useState(null);
  const [errores, setErrores] = useState({});
  const [mensaje, setMensaje] = useState(null);
  const [aEliminar, setAEliminar] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [mensajeFormulario, setMensajeFormulario] = useState('');

  const votacion = votaciones.find((v) => v.id === Number(id));
  if (!votacion) return <NoEncontrado mensaje="La votación no existe." />;
  const lista = opciones.filter((o) => o.votacionId === votacion.id).sort((a, b) => a.orden - b.orden);
  const votosDe = (opId) => votos.filter((v) => v.opcionId === opId).length;

  const abrirFormulario = (valores) => {
    setErrores({});
    setMensajeFormulario('');
    setForm(valores);
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (procesando) return;
    const errs = {};
    if (form.nombre.trim().length < 3) errs.nombre = 'El nombre debe tener al menos 3 caracteres.';
    if (!validarEnlaceMultimedia(form.enlaceMultimedia.trim())) {
      errs.enlaceMultimedia = 'Ingresa una URL que empiece por http:// o https://, una ruta del sitio que empiece por «/», o déjalo vacío.';
    }
    setErrores(errs);
    if (Object.keys(errs).length) return;
    setProcesando(true);
    const r = await guardarEntidad('opciones', { ...form, enlaceMultimedia: form.enlaceMultimedia.trim() }, `${form.id ? 'Actualizó' : 'Agregó'} la opción "${form.nombre}" en "${votacion.titulo}"`);
    setProcesando(false);
    if (!r.ok) {
      setErrores(r.errores || {});
      setMensajeFormulario(r.error);
      return;
    }
    setMensaje({ tipo: 'success', texto: `Opción «${form.nombre}» ${form.id ? 'actualizada' : 'agregada'}.` });
    setForm(null);
  };

  const mover = async (indice, delta) => {
    const destino = indice + delta;
    if (destino < 0 || destino >= lista.length) return;
    const nuevaLista = [...lista];
    [nuevaLista[indice], nuevaLista[destino]] = [nuevaLista[destino], nuevaLista[indice]];
    const ordenes = new Map(nuevaLista.map((o, i) => [o.id, i + 1]));
    setProcesando(true);
    const r = await reemplazarColeccion(
      'opciones',
      opciones.map((o) => (ordenes.has(o.id) ? { ...o, orden: ordenes.get(o.id) } : o)),
      `Reordenó las opciones de "${votacion.titulo}"`
    );
    setProcesando(false);
    if (!r.ok) setMensaje({ tipo: 'danger', texto: r.error });
  };

  const pedirEliminar = (o) => {
    if (votosDe(o.id) > 0) {
      setMensaje({ tipo: 'warning', texto: `No se puede eliminar «${o.nombre}»: ya tiene votos registrados (integridad de resultados, RN-09).` });
      return;
    }
    if (votacion.publicada && lista.length <= 2) {
      setMensaje({ tipo: 'danger', texto: 'No se puede eliminar: una votación publicada debe conservar al menos 2 opciones (RN-06).' });
      return;
    }
    setAEliminar(o);
  };

  const categoria = categorias.find((c) => c.id === votacion.categoriaId);

  return (
    <>
      <PageHeader
        titulo="Gestión de opciones"
        subtitulo={`${votacion.titulo} · ${categoria?.nombre} (RF-13)`}
        migas={[{ label: 'Votaciones', to: '/admin/votaciones' }, { label: votacion.titulo }, { label: 'Opciones' }]}
      >
        <button
          className="btn btn-primary"
          onClick={() => abrirFormulario({ votacionId: votacion.id, nombre: '', descripcion: '', enlaceMultimedia: '', orden: lista.length + 1 })}
        >
          <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>Agregar opción
        </button>
      </PageHeader>

      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        <EstadoBadge estado={votacion.estado} />
        {!votacion.publicada && <span className="badge text-bg-secondary">Borrador</span>}
        <span className="small">{lista.length} opciones · {votos.filter((v) => v.votacionId === votacion.id).length} votos</span>
      </div>

      {lista.length < 2 && (
        <div className="alert alert-warning" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-1" aria-hidden="true"></i>
          Esta votación tiene {lista.length} opción(es). Se necesitan <strong>al menos 2 opciones</strong> para publicarla o abrirla (RN-06).
        </div>
      )}
      {mensaje && (
        <div className={`alert alert-${mensaje.tipo} alert-dismissible`} role="status">
          {mensaje.texto}
          <button type="button" className="btn-close" aria-label="Cerrar mensaje" onClick={() => setMensaje(null)}></button>
        </div>
      )}

      <ol className="list-unstyled d-grid gap-2" aria-label="Opciones en orden de presentación">
        {lista.map((o, i) => (
          <li key={o.id} className="card-flv p-3 d-flex flex-wrap align-items-center gap-3">
            <span className="fw-bold text-secondary-flv" style={{ minWidth: '1.5rem' }}>{o.orden}</span>
            <Avatar nombre={o.nombre} tamano={44} />
            <div className="flex-grow-1" style={{ minWidth: '12rem' }}>
              <p className="fw-semibold mb-0">{o.nombre}</p>
              <p className="small text-secondary-flv mb-0">
                {o.descripcion}
              </p>
              {o.enlaceMultimedia && <ReproductorMultimedia enlace={o.enlaceMultimedia} titulo={o.nombre} className="mt-2" />}
            </div>
            <span className="small text-nowrap">{votosDe(o.id)} votos</span>
            <div className="btn-group" role="group" aria-label={`Acciones para ${o.nombre}`}>
              <button className="btn btn-sm btn-outline-secondary" disabled={i === 0 || procesando} onClick={() => mover(i, -1)} aria-label={`Subir ${o.nombre}`} title="Subir">
                <i className="bi bi-arrow-up" aria-hidden="true"></i>
              </button>
              <button className="btn btn-sm btn-outline-secondary" disabled={i === lista.length - 1 || procesando} onClick={() => mover(i, 1)} aria-label={`Bajar ${o.nombre}`} title="Bajar">
                <i className="bi bi-arrow-down" aria-hidden="true"></i>
              </button>
              <button className="btn btn-sm btn-outline-primary" onClick={() => abrirFormulario({ ...o, enlaceMultimedia: o.enlaceMultimedia || '' })} aria-label={`Editar ${o.nombre}`} title="Editar">
                <i className="bi bi-pencil" aria-hidden="true"></i>
              </button>
              <button className="btn btn-sm btn-outline-danger" onClick={() => pedirEliminar(o)} aria-label={`Eliminar ${o.nombre}`} title="Eliminar">
                <i className="bi bi-trash" aria-hidden="true"></i>
              </button>
            </div>
          </li>
        ))}
      </ol>

      <Link to="/admin/votaciones" className="btn btn-outline-primary mt-3"><i className="bi bi-arrow-left me-1" aria-hidden="true"></i>Volver a votaciones</Link>

      <Modal
        abierto={!!form}
        titulo={form?.id ? 'Editar opción' : 'Agregar opción'}
        onCerrar={() => setForm(null)}
        pie={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setForm(null)}>Cancelar</button>
            <button className="btn btn-primary" type="submit" form="form-opcion" disabled={procesando}>{procesando ? 'Guardando…' : 'Guardar'}</button>
          </>
        }
      >
        {form && (
          <form id="form-opcion" noValidate onSubmit={guardar}>
            {mensajeFormulario && <div className="alert alert-danger py-2" role="alert">{mensajeFormulario}</div>}
            <div className="mb-3">
              <label className="form-label" htmlFor="o-nombre">Nombre</label>
              <input id="o-nombre" className={`form-control ${errores.nombre ? 'is-invalid' : ''}`} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              {errores.nombre && <div className="invalid-feedback">{errores.nombre}</div>}
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="o-desc">Descripción</label>
              <textarea id="o-desc" rows="2" className="form-control" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })}></textarea>
            </div>
            <div className="mb-1">
              <label className="form-label" htmlFor="o-enlace">Enlace multimedia <span className="fw-normal text-secondary-flv">(opcional)</span></label>
              <input id="o-enlace" type="text" inputMode="url" placeholder="https://… o /audio/muestras/archivo.mp3" className={`form-control ${errores.enlaceMultimedia ? 'is-invalid' : ''}`} value={form.enlaceMultimedia} onChange={(e) => setForm({ ...form, enlaceMultimedia: e.target.value })} aria-describedby="o-enlace-ayuda" />
              {errores.enlaceMultimedia ? (
                <div className="invalid-feedback">{errores.enlaceMultimedia}</div>
              ) : (
                <div id="o-enlace-ayuda" className="form-text">
                  Archivo de audio (.mp3, .ogg, .wav, .m4a) del sitio o externo, o un enlace de YouTube, Spotify o SoundCloud. Las rutas del
                  sitio empiezan por «/».
                </div>
              )}
              {form.enlaceMultimedia && validarEnlaceMultimedia(form.enlaceMultimedia.trim()) && (
                <ReproductorMultimedia enlace={form.enlaceMultimedia.trim()} titulo={form.nombre || 'opción'} className="mt-2" />
              )}
            </div>
            <p className="small text-secondary-flv mb-0">La imagen se genera automáticamente como avatar ilustrativo (sin fotos reales).</p>
          </form>
        )}
      </Modal>

      <Modal
        abierto={!!aEliminar}
        titulo="Eliminar opción"
        onCerrar={() => setAEliminar(null)}
        pie={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setAEliminar(null)}>Cancelar</button>
            <button
              className="btn btn-peligro"
              disabled={procesando}
              onClick={async () => {
                setProcesando(true);
                const r = await eliminarEntidad('opciones', aEliminar.id, `Eliminó la opción "${aEliminar.nombre}" de "${votacion.titulo}"`);
                setProcesando(false);
                setMensaje(r.ok ? { tipo: 'success', texto: `Opción «${aEliminar.nombre}» eliminada.` } : { tipo: 'danger', texto: r.error });
                setAEliminar(null);
              }}
            >
              Eliminar
            </button>
          </>
        }
      >
        <p className="mb-0">¿Eliminar la opción «{aEliminar?.nombre}»?</p>
      </Modal>
    </>
  );
}
