import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Modal from '../../components/Modal.jsx';
import EstadoBadge from '../../components/EstadoBadge.jsx';
import { OPCIONES_MOSTRAR_RESULTADOS, PATRON_SLUG, formatearFechaHora, isoALocal, localAIso } from '../../utils/helpers.js';

const ICONOS = ['music-note-beamed', 'vinyl-fill', 'people-fill', 'stars', 'boombox-fill', 'music-player-fill', 'award-fill', 'music-note', 'mic-fill'];

export default function AdminVotaciones() {
  const { votaciones, categorias, ediciones, opciones, votos, guardarEntidad, eliminarEntidad } = useApp();
  // Con varias ediciones los nombres de categoría se repiten: se muestran con el año
  const etiquetaCategoria = (c) => `${c.nombre} (${ediciones.find((e) => e.id === c.edicionId)?.anio ?? '—'})`;
  const [filtroCat, setFiltroCat] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [form, setForm] = useState(null);
  const [errores, setErrores] = useState({});
  const [mensaje, setMensaje] = useState(null);
  const [aEliminar, setAEliminar] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [mensajeFormulario, setMensajeFormulario] = useState('');

  const numOpciones = (id) => opciones.filter((o) => o.votacionId === id).length;
  const numVotos = (id) => votos.filter((v) => v.votacionId === id).length;
  const catNombre = (id) => categorias.find((c) => c.id === id)?.nombre || '—';

  const lista = votaciones
    .filter((v) => !filtroCat || v.categoriaId === Number(filtroCat))
    .filter((v) => !filtroEstado || (filtroEstado === 'borrador' ? !v.publicada : v.publicada && v.estado === filtroEstado))
    .sort((a, b) => a.categoriaId - b.categoriaId || a.id - b.id);

  const nueva = () => {
    setErrores({});
    setMensajeFormulario('');
    const ahora = new Date();
    setForm({
      categoriaId: categorias[0]?.id || '',
      titulo: '',
      slug: '',
      descripcion: '',
      fechaApertura: isoALocal(new Date(ahora.getTime() + 86400000).toISOString()),
      fechaCierre: isoALocal(new Date(ahora.getTime() + 8 * 86400000).toISOString()),
      votosPorUsuario: 1,
      mostrarResultados: 'al cerrar',
      imagen: ICONOS[0],
      publicada: false,
      cerradaManualmente: false,
      resultadosPublicados: false,
    });
  };

  const editar = (v) => {
    setErrores({});
    setMensajeFormulario('');
    setForm({ ...v, slug: v.slug || '', fechaApertura: isoALocal(v.fechaApertura), fechaCierre: isoALocal(v.fechaCierre) });
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (procesando) return;
    const errs = {};
    if (form.slug && !PATRON_SLUG.test(form.slug)) errs.slug = 'Usa solo minúsculas sin tildes, números y guiones (p. ej. «cancion-favorita»).';
    if (!form.categoriaId) errs.categoriaId = 'Toda votación debe pertenecer a una categoría.';
    if (form.titulo.trim().length < 5) errs.titulo = 'El título debe tener al menos 5 caracteres.';
    if (!form.descripcion.trim()) errs.descripcion = 'La descripción es obligatoria.';
    if (!form.fechaApertura) errs.fechaApertura = 'Indica la fecha de apertura.';
    if (!form.fechaCierre || form.fechaCierre <= form.fechaApertura) errs.fechaCierre = 'La fecha de cierre debe ser posterior a la de apertura.';
    if (Number(form.votosPorUsuario) < 1) errs.votosPorUsuario = 'Debe ser al menos 1.';
    if (form.publicada && (!form.id || numOpciones(form.id) < 2)) {
      errs.publicada = 'No se puede publicar: la votación necesita al menos 2 opciones. Guárdala como borrador y agrega opciones.';
    }
    setErrores(errs);
    if (Object.keys(errs).length) return;
    // eslint-disable-next-line no-unused-vars
    const { estado, ...resto } = form;
    const datos = {
      ...resto,
      categoriaId: Number(form.categoriaId),
      votosPorUsuario: Number(form.votosPorUsuario),
      fechaApertura: localAIso(form.fechaApertura),
      fechaCierre: localAIso(form.fechaCierre),
      slug: form.slug.trim(),
    };
    setProcesando(true);
    const r = await guardarEntidad('votaciones', datos, `${form.id ? 'Actualizó' : 'Creó'} la votación "${form.titulo}"`);
    setProcesando(false);
    if (!r.ok) {
      setErrores(r.errores || {});
      setMensajeFormulario(r.error);
      return;
    }
    const g = r.entidad;
    setMensaje({
      tipo: 'success',
      texto: form.id ? `Votación «${form.titulo}» actualizada.` : `Votación «${form.titulo}» creada como borrador. Agrega al menos 2 opciones para publicarla.`,
      opcionesId: form.id ? null : g.id,
    });
    setForm(null);
  };

  // La regla de mínimo dos opciones la valida la capa de datos (y el servidor en el modo API)
  const alternarPublicada = async (v) => {
    setProcesando(true);
    const r = await guardarEntidad('votaciones', { id: v.id, publicada: !v.publicada }, `${v.publicada ? 'Despublicó' : 'Publicó'} la votación "${v.titulo}"`);
    setProcesando(false);
    if (!r.ok) {
      setMensaje({ tipo: 'danger', texto: `No se puede ${v.publicada ? 'despublicar' : 'publicar'} «${v.titulo}»: ${r.error}`, opcionesId: v.publicada ? null : v.id });
      return;
    }
    setMensaje({ tipo: 'success', texto: `Votación «${v.titulo}» ${v.publicada ? 'retirada del sitio público' : 'publicada'}.` });
  };

  const cerrar = async (v) => {
    setProcesando(true);
    const r = await guardarEntidad('votaciones', { id: v.id, cerradaManualmente: true }, `Cerró manualmente la votación "${v.titulo}"`);
    setProcesando(false);
    setMensaje(r.ok ? { tipo: 'info', texto: `Votación «${v.titulo}» cerrada. Ya no recibe votos.` } : { tipo: 'danger', texto: r.error });
    setAEliminar(null);
  };

  const eliminar = async (v) => {
    setProcesando(true);
    const r = await eliminarEntidad('votaciones', v.id, `Eliminó la votación "${v.titulo}"`);
    setProcesando(false);
    setMensaje(r.ok ? { tipo: 'success', texto: `Votación «${v.titulo}» eliminada.` } : { tipo: 'danger', texto: r.error });
    setAEliminar(null);
  };

  const pedirEliminar = (v) => {
    setAEliminar(v);
  };

  const votosAEliminar = aEliminar ? numVotos(aEliminar.id) : 0;

  return (
    <>
      <PageHeader titulo="Gestión de votaciones" subtitulo="Crear, editar, publicar y cerrar votaciones.">
        <button className="btn btn-primary" onClick={nueva}><i className="bi bi-plus-lg me-1" aria-hidden="true"></i>Nueva votación</button>
      </PageHeader>

      {mensaje && (
        <div className={`alert alert-${mensaje.tipo} alert-dismissible`} role="status">
          {mensaje.texto}{' '}
          {mensaje.opcionesId && <Link to={`/admin/votaciones/${mensaje.opcionesId}/opciones`} className="alert-link">Gestionar opciones</Link>}
          <button type="button" className="btn-close" aria-label="Cerrar mensaje" onClick={() => setMensaje(null)}></button>
        </div>
      )}

      <div className="card-flv p-3 mb-3">
        <div className="row g-2">
          <div className="col-sm-6">
            <label htmlFor="f-cat" className="form-label small mb-1">Categoría</label>
            <select id="f-cat" className="form-select form-select-sm" value={filtroCat} onChange={(e) => setFiltroCat(e.target.value)}>
              <option value="">Todas</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{etiquetaCategoria(c)}</option>)}
            </select>
          </div>
          <div className="col-sm-6">
            <label htmlFor="f-estado" className="form-label small mb-1">Estado</label>
            <select id="f-estado" className="form-select form-select-sm" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
              <option value="">Todos</option>
              <option value="abierta">Abierta</option>
              <option value="programada">Programada</option>
              <option value="cerrada">Cerrada</option>
              <option value="borrador">Borrador (sin publicar)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="table-responsive card-flv">
        <table className="table table-flv table-hover align-middle mb-0">
          <caption className="visually-hidden">Listado de votaciones</caption>
          <thead>
            <tr>
              <th scope="col">Votación</th>
              <th scope="col">Fechas</th>
              <th scope="col">Estado</th>
              <th scope="col">Opc.</th>
              <th scope="col">Votos</th>
              <th scope="col" className="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((v) => (
              <tr key={v.id}>
                <td>
                  <strong>{v.titulo}</strong> <code className="small text-secondary-flv">/{v.slug}</code>
                  <div className="small text-secondary-flv">{catNombre(v.categoriaId)} · Resultados: {v.mostrarResultados}</div>
                </td>
                <td className="small text-nowrap">
                  {formatearFechaHora(v.fechaApertura)}
                  <br />
                  {formatearFechaHora(v.fechaCierre)}
                </td>
                <td>
                  <div className="d-flex flex-column gap-1 align-items-start">
                    <EstadoBadge estado={v.estado} />
                    {!v.publicada && <span className="badge text-bg-secondary">Borrador</span>}
                  </div>
                </td>
                <td>
                  <span className={numOpciones(v.id) < 2 ? 'text-danger fw-bold' : ''}>{numOpciones(v.id)}</span>
                </td>
                <td>{numVotos(v.id)}</td>
                <td className="text-end">
                  <div className="d-inline-flex flex-nowrap justify-content-end gap-1">
                    <button className="btn btn-sm btn-outline-primary" onClick={() => editar(v)} aria-label={`Editar ${v.titulo}`} title="Editar">
                      <i className="bi bi-pencil" aria-hidden="true"></i>
                    </button>
                    <Link className="btn btn-sm btn-outline-primary" to={`/admin/votaciones/${v.id}/opciones`} aria-label={`Opciones de ${v.titulo}`} title="Opciones">
                      <i className="bi bi-list-ol" aria-hidden="true"></i>
                    </Link>
                    <button className={`btn btn-sm ${v.publicada ? 'btn-outline-secondary' : 'btn-dorado'}`} disabled={procesando} onClick={() => alternarPublicada(v)} aria-label={`${v.publicada ? 'Despublicar' : 'Publicar'} ${v.titulo}`} title={v.publicada ? 'Despublicar' : 'Publicar'}>
                      <i className={`bi ${v.publicada ? 'bi-eye-slash' : 'bi-megaphone'}`} aria-hidden="true"></i>
                    </button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => pedirEliminar(v)} aria-label={`Eliminar ${v.titulo}`} title="Eliminar">
                      <i className="bi bi-trash" aria-hidden="true"></i>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {lista.length === 0 && (
              <tr><td colSpan="6" className="text-center py-4">No hay votaciones con esos filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        abierto={!!form}
        tamano="modal-lg"
        titulo={form?.id ? 'Editar votación' : 'Nueva votación'}
        onCerrar={() => setForm(null)}
        pie={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setForm(null)}>Cancelar</button>
            <button className="btn btn-primary" type="submit" form="form-votacion" disabled={procesando}>{procesando ? 'Guardando…' : 'Guardar'}</button>
          </>
        }
      >
        {form && (
          <form id="form-votacion" noValidate onSubmit={guardar}>
            {mensajeFormulario && <div className="alert alert-danger py-2" role="alert">{mensajeFormulario}</div>}
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label" htmlFor="v-cat">Categoría</label>
                <select id="v-cat" className={`form-select ${errores.categoriaId ? 'is-invalid' : ''}`} value={form.categoriaId} onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}>
                  {categorias.map((c) => <option key={c.id} value={c.id}>{etiquetaCategoria(c)}</option>)}
                </select>
                {errores.categoriaId && <div className="invalid-feedback">{errores.categoriaId}</div>}
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="v-img">Imagen (ícono ilustrativo)</label>
                <select id="v-img" className="form-select" value={form.imagen} onChange={(e) => setForm({ ...form, imagen: e.target.value })}>
                  {ICONOS.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="v-titulo">Título</label>
                <input id="v-titulo" className={`form-control ${errores.titulo ? 'is-invalid' : ''}`} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
                {errores.titulo && <div className="invalid-feedback">{errores.titulo}</div>}
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="v-slug">Identificador en la URL <span className="fw-normal text-secondary-flv">(opcional)</span></label>
                <input id="v-slug" className={`form-control ${errores.slug ? 'is-invalid' : ''}`} value={form.slug} placeholder="se genera desde el título" onChange={(e) => setForm({ ...form, slug: e.target.value })} aria-describedby="v-slug-ayuda" />
                {errores.slug ? <div className="invalid-feedback">{errores.slug}</div> : <div id="v-slug-ayuda" className="form-text">Última parte de la dirección pública de la votación. Déjalo vacío para generarlo automáticamente.</div>}
              </div>
              <div className="col-12">
                <label className="form-label" htmlFor="v-desc">Descripción</label>
                <textarea id="v-desc" rows="2" className={`form-control ${errores.descripcion ? 'is-invalid' : ''}`} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })}></textarea>
                {errores.descripcion && <div className="invalid-feedback">{errores.descripcion}</div>}
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="v-ap">Fecha y hora de apertura</label>
                <input id="v-ap" type="datetime-local" className={`form-control ${errores.fechaApertura ? 'is-invalid' : ''}`} value={form.fechaApertura} onChange={(e) => setForm({ ...form, fechaApertura: e.target.value })} />
                {errores.fechaApertura && <div className="invalid-feedback">{errores.fechaApertura}</div>}
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="v-ci">Fecha y hora de cierre</label>
                <input id="v-ci" type="datetime-local" className={`form-control ${errores.fechaCierre ? 'is-invalid' : ''}`} value={form.fechaCierre} onChange={(e) => setForm({ ...form, fechaCierre: e.target.value })} />
                {errores.fechaCierre && <div className="invalid-feedback">{errores.fechaCierre}</div>}
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="v-vpu">Votos por usuario</label>
                <input id="v-vpu" type="number" min="1" max="5" className={`form-control ${errores.votosPorUsuario ? 'is-invalid' : ''}`} value={form.votosPorUsuario} onChange={(e) => setForm({ ...form, votosPorUsuario: e.target.value })} aria-describedby="v-vpu-ayuda" />
                <div id="v-vpu-ayuda" className="form-text">Por defecto 1 (pendiente de validación con la Fundación).</div>
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="v-mr">Mostrar resultados</label>
                <select id="v-mr" className="form-select" value={form.mostrarResultados} onChange={(e) => setForm({ ...form, mostrarResultados: e.target.value })} aria-describedby="v-mr-ayuda">
                  {OPCIONES_MOSTRAR_RESULTADOS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <div id="v-mr-ayuda" className="form-text">Visibilidad pública de los resultados.</div>
              </div>
              <div className="col-12">
                <div className="form-check form-switch">
                  <input id="v-pub" className={`form-check-input ${errores.publicada ? 'is-invalid' : ''}`} type="checkbox" role="switch" checked={form.publicada} onChange={(e) => setForm({ ...form, publicada: e.target.checked })} aria-describedby="v-pub-ayuda" />
                  <label className="form-check-label" htmlFor="v-pub">Publicar votación (visible al público)</label>
                  {errores.publicada && <div className="invalid-feedback d-block" role="alert">{errores.publicada}</div>}
                  <div id="v-pub-ayuda" className="form-text">
                    {form.id ? `Opciones registradas: ${numOpciones(form.id)}.` : 'Las votaciones nuevas se crean como borrador.'} Se requieren al menos 2 opciones para publicar.
                  </div>
                </div>
              </div>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        abierto={!!aEliminar}
        titulo={votosAEliminar > 0 ? 'No es posible eliminar' : 'Eliminar votación'}
        onCerrar={() => setAEliminar(null)}
        pie={
          votosAEliminar > 0 ? (
            <>
              <button className="btn btn-outline-secondary" onClick={() => setAEliminar(null)}>Entendido</button>
              {aEliminar?.estado !== 'cerrada' && (
                <button className="btn btn-peligro" disabled={procesando} onClick={() => cerrar(aEliminar)}>
                  <i className="bi bi-lock me-1" aria-hidden="true"></i>Cerrar votación
                </button>
              )}
            </>
          ) : (
            <>
              <button className="btn btn-outline-secondary" onClick={() => setAEliminar(null)}>Cancelar</button>
              <button className="btn btn-peligro" disabled={procesando} onClick={() => eliminar(aEliminar)}>
                Eliminar
              </button>
            </>
          )
        }
      >
        {votosAEliminar > 0 ? (
          <div className="alert alert-warning mb-0" role="alert">
            <i className="bi bi-shield-exclamation me-1" aria-hidden="true"></i>
            La votación «{aEliminar?.titulo}» tiene <strong>{votosAEliminar} votos</strong> registrados. Una votación
            con votos no se puede eliminar, solo cerrar.
          </div>
        ) : (
          <p className="mb-0">¿Eliminar la votación «{aEliminar?.titulo}» y sus opciones? No tiene votos registrados.</p>
        )}
      </Modal>
    </>
  );
}
