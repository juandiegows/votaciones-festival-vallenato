import { Fragment, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import { useEdicionAdmin } from '../../context/EdicionAdmin.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Modal from '../../components/Modal.jsx';
import EstadoBadge from '../../components/EstadoBadge.jsx';
import IconoEntidad from '../../components/IconoEntidad.jsx';
import SelectorIcono from '../../components/SelectorIcono.jsx';
import SelectorVista, { useVistaGuardada } from '../../components/SelectorVista.jsx';
import FormularioOpcion, { opcionNueva } from '../../components/admin/FormularioOpcion.jsx';
import OpcionesAdmin from '../../components/admin/OpcionesAdmin.jsx';
import { PRESENTACIONES_OPCIONES, presentacionOpciones } from '../../data/presentaciones.js';
import { DESCRIPCION_RESULTADOS, OPCIONES_MOSTRAR_RESULTADOS, PATRON_SLUG, formatearFechaHora, isoALocal, localAIso, visibilidadResultados, votosPermitidos } from '../../utils/helpers.js';

const normalizar = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const ORDENES = [
  ['apertura', 'Fecha de apertura'],
  ['cierre', 'Fecha de cierre'],
  ['titulo', 'Título (A-Z)'],
  ['votos', 'Más votos'],
];
const AVISO_ABIERTA = 'Abierta: no se puede despublicar hasta el cierre.';

function leerPreferencia(clave, porDefecto) {
  try {
    const v = localStorage.getItem(clave);
    return v === null ? porDefecto : v === '1';
  } catch {
    return porDefecto;
  }
}
function guardarPreferencia(clave, valor) {
  try {
    localStorage.setItem(clave, valor ? '1' : '0');
  } catch {
    /* almacenamiento no disponible */
  }
}

export default function AdminVotaciones() {
  const { guardarEntidad, eliminarEntidad } = useApp();
  const { edicion, categorias, votaciones, opciones, votos } = useEdicionAdmin();
  const location = useLocation();
  const [filtros, setFiltros] = useState({
    texto: '', categoria: location.state?.categoriaId ? String(location.state.categoriaId) : '', estado: '', resultados: '', votos: '', orden: 'apertura',
  });
  const [agrupar, setAgrupar] = useState(() => leerPreferencia('flv_votaciones_agrupar', true));
  const [verOpciones, setVerOpciones] = useState(() => leerPreferencia('flv_votaciones_opciones', true));
  // Móvil: los filtros avanzados se pliegan para que la lista quede a la vista
  const [masFiltros, setMasFiltros] = useState(false);
  const [vista, setVista] = useVistaGuardada('votaciones', 'lista');
  const [form, setForm] = useState(null);
  const [formOpcion, setFormOpcion] = useState(null);
  const [errores, setErrores] = useState({});
  const [mensaje, setMensaje] = useState(null);
  const [aEliminar, setAEliminar] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [mensajeFormulario, setMensajeFormulario] = useState('');

  const cambiarFiltro = (campo, valor) => setFiltros((f) => ({ ...f, [campo]: valor }));
  const numOpciones = (id) => opciones.filter((o) => o.votacionId === id).length;
  const numVotos = (id) => votos.filter((v) => v.votacionId === id).length;
  const categoriaDe = (id) => categorias.find((c) => c.id === id);

  const q = normalizar(filtros.texto.trim());
  const comparar = {
    apertura: (a, b) => new Date(a.fechaApertura) - new Date(b.fechaApertura),
    cierre: (a, b) => new Date(a.fechaCierre) - new Date(b.fechaCierre),
    titulo: (a, b) => a.titulo.localeCompare(b.titulo, 'es'),
    votos: (a, b) => numVotos(b.id) - numVotos(a.id),
  }[filtros.orden];
  const lista = votaciones
    .filter((v) => !q || normalizar(`${v.titulo} ${v.descripcion} ${v.slug} ${opciones.filter((o) => o.votacionId === v.id).map((o) => o.nombre).join(' ')}`).includes(q))
    .filter((v) => !filtros.categoria || v.categoriaId === Number(filtros.categoria))
    .filter((v) => !filtros.estado || (filtros.estado === 'borrador' ? !v.publicada : v.publicada && v.estado === filtros.estado))
    .filter((v) => !filtros.resultados || visibilidadResultados(v) === filtros.resultados)
    .filter((v) => !filtros.votos || (filtros.votos === 'con' ? numVotos(v.id) > 0 : numVotos(v.id) === 0))
    .sort(comparar);
  const hayFiltros = filtros.texto || filtros.categoria || filtros.estado || filtros.resultados || filtros.votos;

  const grupos = agrupar
    ? [...categorias].sort((a, b) => a.orden - b.orden).map((c) => ({ categoria: c, votaciones: lista.filter((v) => v.categoriaId === c.id) })).filter((g) => g.votaciones.length)
    : [{ categoria: null, votaciones: lista }];

  const nueva = (categoriaId) => {
    setErrores({});
    setMensajeFormulario('');
    const ahora = new Date();
    const cat = categoriaDe(Number(categoriaId)) || categorias[0];
    setForm({
      categoriaId: cat?.id || '',
      titulo: '',
      slug: '',
      descripcion: '',
      fechaApertura: isoALocal(new Date(ahora.getTime() + 86400000).toISOString()),
      fechaCierre: isoALocal(new Date(ahora.getTime() + 8 * 86400000).toISOString()),
      votosPorUsuario: edicion?.votosPorUsuario ?? 1,
      mostrarResultados: edicion?.mostrarResultados || 'al cerrar',
      personalizarResultados: false,
      personalizarVotos: false,
      imagen: cat?.icono || 'music-note-beamed',
      iconoImagen: '',
      archivoIcono: null,
      quitarIcono: false,
      presentacionOpciones: 'tarjetas',
      publicada: false,
      cerradaManualmente: false,
      resultadosPublicados: false,
    });
  };

  const editar = (v) => {
    setErrores({});
    setMensajeFormulario('');
    setForm({
      ...v, slug: v.slug || '', fechaApertura: isoALocal(v.fechaApertura), fechaCierre: isoALocal(v.fechaCierre),
      iconoImagen: v.iconoImagen || '', archivoIcono: null, quitarIcono: false, presentacionOpciones: v.presentacionOpciones || 'tarjetas',
      publicadaOriginal: v.publicada,
    });
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
    const { estado, archivoIcono, quitarIcono, iconoImagen, publicadaOriginal, ...resto } = form;
    const datos = {
      ...resto,
      categoriaId: Number(form.categoriaId),
      votosPorUsuario: Number(form.votosPorUsuario),
      fechaApertura: localAIso(form.fechaApertura),
      fechaCierre: localAIso(form.fechaCierre),
      slug: form.slug.trim(),
    };
    if (archivoIcono) datos.archivoIcono = archivoIcono;
    else if (quitarIcono) datos.quitarIcono = true;
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
      agregarOpcionA: form.id ? null : g,
    });
    setForm(null);
  };

  // La regla de mínimo dos opciones y la de no despublicar abiertas las valida también la capa de datos (y el servidor)
  const alternarPublicada = async (v) => {
    if (v.publicada && v.estado === 'abierta') return setMensaje({ tipo: 'warning', texto: `«${v.titulo}» está abierta: no se puede despublicar hasta el cierre.` });
    setProcesando(true);
    const r = await guardarEntidad('votaciones', { id: v.id, publicada: !v.publicada }, `${v.publicada ? 'Despublicó' : 'Publicó'} la votación "${v.titulo}"`);
    setProcesando(false);
    if (!r.ok) {
      setMensaje({ tipo: 'danger', texto: `No se puede ${v.publicada ? 'despublicar' : 'publicar'} «${v.titulo}»: ${r.error}`, agregarOpcionA: v.publicada ? null : v });
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

  const agregarOpcion = (v) => setFormOpcion({ votacion: v, opcion: opcionNueva(v, numOpciones(v.id) + 1) });
  const editarOpcion = (v, o) => setFormOpcion({ votacion: v, opcion: o });

  const votosAEliminar = aEliminar ? numVotos(aEliminar.id) : 0;

  // ---------- Piezas reutilizadas por las vistas ----------
  const insignias = (v) => (
    <span className="d-inline-flex flex-wrap gap-1 align-items-center">
      <EstadoBadge estado={v.estado} />
      {!v.publicada && <span className="badge text-bg-secondary">Borrador</span>}
    </span>
  );

  const acciones = (v) => {
    const bloqueada = v.publicada && v.estado === 'abierta';
    return (
      <span className="d-inline-flex flex-nowrap justify-content-end gap-1">
        <button className="btn btn-sm btn-outline-primary" onClick={() => editar(v)} aria-label={`Editar ${v.titulo}`} title="Editar">
          <i className="bi bi-pencil" aria-hidden="true"></i>
        </button>
        <Link className="btn btn-sm btn-outline-primary" to={`/panel/votaciones/${v.id}/opciones`} aria-label={`Página de opciones de ${v.titulo}`} title="Página de opciones">
          <i className="bi bi-list-ol" aria-hidden="true"></i>
        </Link>
        <span title={bloqueada ? AVISO_ABIERTA : v.publicada ? 'Despublicar' : 'Publicar'}>
          <button
            className={`btn btn-sm ${v.publicada ? 'btn-outline-secondary' : 'btn-dorado'}`}
            disabled={procesando || bloqueada}
            onClick={() => alternarPublicada(v)}
            aria-label={bloqueada ? `${v.titulo}: ${AVISO_ABIERTA}` : `${v.publicada ? 'Despublicar' : 'Publicar'} ${v.titulo}`}
          >
            <i className={`bi ${bloqueada ? 'bi-lock' : v.publicada ? 'bi-eye-slash' : 'bi-megaphone'}`} aria-hidden="true"></i>
          </button>
        </span>
        <button className="btn btn-sm btn-outline-danger" onClick={() => setAEliminar(v)} aria-label={`Eliminar ${v.titulo}`} title="Eliminar">
          <i className="bi bi-trash" aria-hidden="true"></i>
        </button>
      </span>
    );
  };

  const cabeceraOpciones = (v) => (
    <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
      <span className="small fw-semibold">
        Opciones <span className={numOpciones(v.id) < 2 ? 'text-danger' : 'text-secondary-flv'}>({numOpciones(v.id)})</span>
      </span>
      {v.estado === 'cerrada' ? (
        <span className="small text-secondary-flv"><i className="bi bi-lock me-1" aria-hidden="true"></i>Cerrada: no admite opciones nuevas</span>
      ) : (
        <button type="button" className="btn btn-sm btn-primary py-0 px-2" onClick={() => agregarOpcion(v)} aria-label={`Agregar opción a ${v.titulo}`}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>Agregar opción
        </button>
      )}
      <span className="small text-secondary-flv ms-auto">
        <i className={`bi bi-${presentacionOpciones(v.presentacionOpciones).icono} me-1`} aria-hidden="true"></i>
        Se muestran como {presentacionOpciones(v.presentacionOpciones).etiqueta.toLowerCase()}
      </span>
    </div>
  );

  const bloqueOpciones = (v) => (
    <div className="opciones-admin-bloque">
      {cabeceraOpciones(v)}
      <OpcionesAdmin votacion={v} compacta onEditar={(o) => editarOpcion(v, o)} onMensaje={setMensaje} />
    </div>
  );

  const avisoAbierta = (v) => v.publicada && v.estado === 'abierta' && (
    <span className="small text-secondary-flv"><i className="bi bi-lock me-1" aria-hidden="true"></i>{AVISO_ABIERTA}</span>
  );

  const fechas = (v) => (
    <span className="small text-secondary-flv">
      <i className="bi bi-calendar-check me-1" aria-hidden="true"></i>{formatearFechaHora(v.fechaApertura)}
      <i className="bi bi-arrow-right mx-1" aria-hidden="true"></i>{formatearFechaHora(v.fechaCierre)}
    </span>
  );

  const vistaTabla = (vs) => (
    <div className="table-responsive card-flv">
      <table className="table table-flv align-middle mb-0">
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
          {vs.map((v) => (
            <Fragment key={v.id}>
              <tr>
                <td>
                  <span className="d-flex align-items-center gap-2">
                    <span className="icono-circulo icono-sm"><IconoEntidad icono={v.imagen || categoriaDe(v.categoriaId)?.icono} imagen={v.iconoImagen} /></span>
                    <span>
                      <strong>{v.titulo}</strong> <code className="small text-secondary-flv">/{v.slug}</code>
                      <span className="small text-secondary-flv d-block">{agrupar ? '' : `${categoriaDe(v.categoriaId)?.nombre} · `}Resultados: {visibilidadResultados(v)}{v.personalizarResultados ? ' (propia)' : ''}</span>
                    </span>
                  </span>
                </td>
                <td className="small text-nowrap">{formatearFechaHora(v.fechaApertura)}<br />{formatearFechaHora(v.fechaCierre)}</td>
                <td>{insignias(v)}</td>
                <td><span className={numOpciones(v.id) < 2 ? 'text-danger fw-bold' : ''}>{numOpciones(v.id)}</span></td>
                <td>{numVotos(v.id)}</td>
                <td className="text-end">{acciones(v)}</td>
              </tr>
              {verOpciones && (
                <tr className="fila-opciones">
                  <td colSpan="6">{bloqueOpciones(v)}</td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );

  const vistaTarjetas = (vs) => (
    <div className="row g-3">
      {vs.map((v) => (
        <div className="col-lg-6" key={v.id}>
          <article className="card-flv h-100 p-3 d-flex flex-column">
            <div className="d-flex align-items-start gap-3 mb-2">
              <span className="icono-circulo"><IconoEntidad icono={v.imagen || categoriaDe(v.categoriaId)?.icono} imagen={v.iconoImagen} /></span>
              <div className="flex-grow-1">
                <div className="mb-1">{insignias(v)}</div>
                <h3 className="h6 mb-0">{v.titulo}</h3>
                <code className="small text-secondary-flv">/{v.slug}</code>
              </div>
            </div>
            <p className="small mb-2">{v.descripcion}</p>
            <div className="mb-2">{fechas(v)}</div>
            <p className="small mb-2">{numOpciones(v.id)} opciones · {numVotos(v.id)} votos · Resultados: {visibilidadResultados(v)}{v.personalizarResultados ? ' (propia)' : ''}</p>
            {verOpciones && <div className="border-top pt-2 mb-2">{bloqueOpciones(v)}</div>}
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-auto border-top pt-2">
              {avisoAbierta(v) || <span></span>}
              {acciones(v)}
            </div>
          </article>
        </div>
      ))}
    </div>
  );

  const vistaLista = (vs) => (
    <ul className="list-unstyled d-grid gap-2 mb-0">
      {vs.map((v) => (
        <li key={v.id} className="card-flv p-3">
          <div className="d-flex flex-wrap align-items-center gap-2 gap-md-3">
            <IconoEntidad icono={v.imagen || categoriaDe(v.categoriaId)?.icono} imagen={v.iconoImagen} className="fs-4 text-rojo icono-lista" />
            <div className="flex-grow-1" style={{ minWidth: '14rem' }}>
              <h3 className="h6 mb-0">{v.titulo}</h3>
              {fechas(v)}
            </div>
            {insignias(v)}
            <span className="small text-nowrap">{numVotos(v.id)} votos</span>
            {acciones(v)}
          </div>
          {avisoAbierta(v) && <div className="mt-1">{avisoAbierta(v)}</div>}
          {verOpciones && <div className="mt-2 ps-md-5">{bloqueOpciones(v)}</div>}
        </li>
      ))}
    </ul>
  );

  const vistaMosaico = (vs) => (
    <div className="row g-2 vista-mosaico">
      {vs.map((v) => (
        <div className="col-sm-6 col-lg-4 col-xxl-3" key={v.id}>
          <article className="card-flv h-100 d-flex flex-column gap-1">
            <div className="d-flex align-items-center gap-2">
              <span className="icono-circulo icono-sm"><IconoEntidad icono={v.imagen || categoriaDe(v.categoriaId)?.icono} imagen={v.iconoImagen} /></span>
              <h3 className="h6 mb-0 flex-grow-1">{v.titulo}</h3>
            </div>
            <div>{insignias(v)}</div>
            <p className="small text-secondary-flv mb-1">{numOpciones(v.id)} opciones · {numVotos(v.id)} votos</p>
            {verOpciones && <div className="border-top pt-2 mb-1">{bloqueOpciones(v)}</div>}
            <div className="mt-auto border-top pt-2 text-end">{acciones(v)}</div>
          </article>
        </div>
      ))}
    </div>
  );

  const vistaCompacta = (vs) => (
    <ul className="list-unstyled lista-compacta mb-0">
      {vs.map((v) => (
        <Fragment key={v.id}>
          <li>
            <IconoEntidad icono={v.imagen || categoriaDe(v.categoriaId)?.icono} imagen={v.iconoImagen} className="text-rojo" />
            <span className="flex-grow-1 text-truncate fw-semibold">{v.titulo}</span>
            <span className="d-none d-md-inline small text-secondary-flv text-nowrap">{formatearFechaHora(v.fechaCierre)}</span>
            {insignias(v)}
            <span className="small text-nowrap">{numVotos(v.id)} votos</span>
            {acciones(v)}
          </li>
          {verOpciones && <li className="d-block">{bloqueOpciones(v)}</li>}
        </Fragment>
      ))}
    </ul>
  );

  const render = { tabla: vistaTabla, tarjetas: vistaTarjetas, lista: vistaLista, mosaico: vistaMosaico, compacta: vistaCompacta }[vista] || vistaLista;
  const presentacionElegida = form && presentacionOpciones(form.presentacionOpciones);
  const publicacionBloqueada = form?.id && form.publicadaOriginal && form.estado === 'abierta';

  return (
    <>
      <PageHeader titulo="Gestión de votaciones" subtitulo={edicion ? `${edicion.nombre} · Crear, editar, publicar y cerrar votaciones y sus opciones.` : 'Crear, editar, publicar y cerrar votaciones.'}>
        <button className="btn btn-primary" onClick={() => nueva(filtros.categoria)} disabled={!categorias.length}><i className="bi bi-plus-lg me-1" aria-hidden="true"></i>Nueva votación</button>
      </PageHeader>

      {!edicion && (
        <div className="alert alert-warning" role="alert">
          No hay ediciones registradas. <Link to="/panel/ediciones" className="alert-link">Crea una edición</Link> y luego sus categorías.
        </div>
      )}
      {edicion && !categorias.length && (
        <div className="alert alert-warning" role="alert">
          Esta edición no tiene categorías. <Link to="/panel/categorias" className="alert-link">Crea una categoría</Link> para agregar votaciones.
        </div>
      )}

      {mensaje && (
        <div className={`alert alert-${mensaje.tipo} alert-dismissible`} role="status">
          {mensaje.texto}{' '}
          {mensaje.agregarOpcionA && (
            <button type="button" className="btn btn-link alert-link p-0 align-baseline" onClick={() => agregarOpcion(mensaje.agregarOpcionA)}>Agregar opciones ahora</button>
          )}
          <button type="button" className="btn-close" aria-label="Cerrar mensaje" onClick={() => setMensaje(null)}></button>
        </div>
      )}

      <section className="card-flv p-3 mb-3" aria-label="Filtros de votaciones">
        <div className="row g-2">
          <div className="col-md-6 col-xl-4">
            <label htmlFor="f-texto" className="form-label small mb-1">Buscar</label>
            <div className="d-flex gap-2">
              <input id="f-texto" type="search" className="form-control form-control-sm" placeholder="Título, descripción u opción" value={filtros.texto} onChange={(e) => cambiarFiltro('texto', e.target.value)} />
              <button type="button" className="btn btn-sm btn-outline-secondary d-md-none text-nowrap" aria-expanded={masFiltros} aria-controls="filtros-avanzados" onClick={() => setMasFiltros((m) => !m)}>
                <i className="bi bi-sliders me-1" aria-hidden="true"></i>Filtros
              </button>
            </div>
          </div>
          <div id="filtros-avanzados" className={`col-12 col-md-6 col-xl-8 ${masFiltros ? '' : 'd-none d-md-block'}`}>
            <div className="row g-2">
              <div className="col-6 col-md-6 col-xl-3">
                <label htmlFor="f-cat" className="form-label small mb-1">Categoría</label>
                <select id="f-cat" className="form-select form-select-sm" value={filtros.categoria} onChange={(e) => cambiarFiltro('categoria', e.target.value)}>
                  <option value="">Todas</option>
                  {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="col-6 col-md-6 col-xl-3">
                <label htmlFor="f-estado" className="form-label small mb-1">Estado</label>
                <select id="f-estado" className="form-select form-select-sm" value={filtros.estado} onChange={(e) => cambiarFiltro('estado', e.target.value)}>
                  <option value="">Todos</option>
                  <option value="abierta">Abierta</option>
                  <option value="programada">Programada</option>
                  <option value="cerrada">Cerrada</option>
                  <option value="borrador">Borrador (sin publicar)</option>
                </select>
              </div>
              <div className="col-6 col-md-4 col-xl-2">
                <label htmlFor="f-res" className="form-label small mb-1">Resultados</label>
                <select id="f-res" className="form-select form-select-sm" value={filtros.resultados} onChange={(e) => cambiarFiltro('resultados', e.target.value)}>
                  <option value="">Cualquiera</option>
                  {OPCIONES_MOSTRAR_RESULTADOS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="col-6 col-md-4 col-xl-2">
                <label htmlFor="f-votos" className="form-label small mb-1">Votos</label>
                <select id="f-votos" className="form-select form-select-sm" value={filtros.votos} onChange={(e) => cambiarFiltro('votos', e.target.value)}>
                  <option value="">Todos</option>
                  <option value="con">Con votos</option>
                  <option value="sin">Sin votos</option>
                </select>
              </div>
              <div className="col-12 col-md-4 col-xl-2">
                <label htmlFor="f-orden" className="form-label small mb-1">Ordenar</label>
                <select id="f-orden" className="form-select form-select-sm" value={filtros.orden} onChange={(e) => cambiarFiltro('orden', e.target.value)}>
                  {ORDENES.map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
        <div className="d-flex flex-wrap align-items-center gap-3 mt-3">
          <div className="form-check form-switch mb-0">
            <input id="f-agrupar" className="form-check-input" type="checkbox" role="switch" checked={agrupar} onChange={(e) => { setAgrupar(e.target.checked); guardarPreferencia('flv_votaciones_agrupar', e.target.checked); }} />
            <label className="form-check-label small" htmlFor="f-agrupar">Agrupar por categoría</label>
          </div>
          <div className="form-check form-switch mb-0">
            <input id="f-ver-opciones" className="form-check-input" type="checkbox" role="switch" checked={verOpciones} onChange={(e) => { setVerOpciones(e.target.checked); guardarPreferencia('flv_votaciones_opciones', e.target.checked); }} />
            <label className="form-check-label small" htmlFor="f-ver-opciones">Mostrar opciones</label>
          </div>
          {hayFiltros && (
            <button type="button" className="btn btn-sm btn-link p-0" onClick={() => setFiltros((f) => ({ ...f, texto: '', categoria: '', estado: '', resultados: '', votos: '' }))}>
              <i className="bi bi-x-circle me-1" aria-hidden="true"></i>Limpiar filtros
            </button>
          )}
          <span className="small text-secondary-flv" aria-live="polite">{lista.length} de {votaciones.length} votaciones</span>
          <span className="ms-auto"><SelectorVista valor={vista} onCambio={setVista} /></span>
        </div>
      </section>

      {lista.length === 0 && (
        <div className="card-flv p-4 text-center">
          <i className="bi bi-inbox fs-1 text-secondary" aria-hidden="true"></i>
          <p className="mb-0">{votaciones.length ? 'No hay votaciones con esos filtros.' : 'Esta edición aún no tiene votaciones.'}</p>
        </div>
      )}

      {lista.length > 0 && grupos.map((g) => (
        <section key={g.categoria?.id || 'todas'} className={agrupar ? 'grupo-categoria mb-4' : ''} aria-labelledby={g.categoria ? `grupo-${g.categoria.id}` : undefined}>
          {g.categoria && (
            <div className="grupo-categoria-cabecera d-flex flex-wrap align-items-center gap-2 mb-2">
              <span className="icono-circulo icono-sm"><IconoEntidad icono={g.categoria.icono} imagen={g.categoria.iconoImagen} /></span>
              <h2 id={`grupo-${g.categoria.id}`} className="h5 mb-0">{g.categoria.nombre}</h2>
              <span className="badge text-bg-light border">{g.votaciones.length} {g.votaciones.length === 1 ? 'votación' : 'votaciones'}</span>
              {!g.categoria.activa && <span className="badge text-bg-secondary">Categoría inactiva</span>}
              <button type="button" className="btn btn-sm btn-outline-primary ms-auto" onClick={() => nueva(g.categoria.id)} aria-label={`Nueva votación en ${g.categoria.nombre}`}>
                <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>Nueva votación
              </button>
            </div>
          )}
          {render(g.votaciones)}
        </section>
      ))}

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
                  {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                {errores.categoriaId && <div className="invalid-feedback">{errores.categoriaId}</div>}
              </div>
              <div className="col-md-6">
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
              <div className="col-12">
                <SelectorIcono
                  leyenda="Ícono de la votación"
                  icono={form.imagen}
                  iconoImagen={form.iconoImagen}
                  archivoIcono={form.archivoIcono}
                  quitarIcono={form.quitarIcono}
                  onCambio={({ icono, ...resto }) => setForm((f) => ({ ...f, ...resto, ...(icono ? { imagen: icono } : {}) }))}
                />
                {errores.iconoImagen && <div className="invalid-feedback d-block">{errores.iconoImagen}</div>}
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
                <div className="form-check mb-1">
                  <input id="v-vpu-propio" className="form-check-input" type="checkbox" checked={!!form.personalizarVotos}
                    onChange={(e) => setForm({ ...form, personalizarVotos: e.target.checked, votosPorUsuario: e.target.checked ? form.votosPorUsuario : edicion?.votosPorUsuario ?? 1 })} />
                  <label className="form-check-label small" htmlFor="v-vpu-propio">Personalizar en esta votación (no usar el de la edición)</label>
                </div>
                <input id="v-vpu" type="number" min="1" max="5" disabled={!form.personalizarVotos}
                  className={`form-control ${errores.votosPorUsuario ? 'is-invalid' : ''}`}
                  value={form.personalizarVotos ? form.votosPorUsuario : edicion?.votosPorUsuario ?? 1}
                  onChange={(e) => setForm({ ...form, votosPorUsuario: e.target.value })} aria-describedby="v-vpu-ayuda" />
                <div id="v-vpu-ayuda" className="form-text">
                  {form.personalizarVotos
                    ? 'Límite propio de esta votación (pendiente de validación con la Fundación).'
                    : <>Hereda el límite de la edición. <Link to="/panel/configuracion">Cambiarlo en Configuración</Link>.</>}
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="v-mr">Mostrar resultados</label>
                <div className="form-check mb-1">
                  <input id="v-mr-propia" className="form-check-input" type="checkbox" checked={!!form.personalizarResultados}
                    onChange={(e) => setForm({ ...form, personalizarResultados: e.target.checked, mostrarResultados: e.target.checked ? form.mostrarResultados : edicion?.mostrarResultados || 'al cerrar' })} />
                  <label className="form-check-label small" htmlFor="v-mr-propia">Personalizar en esta votación (no usar la de la edición)</label>
                </div>
                <select id="v-mr" className="form-select" disabled={!form.personalizarResultados}
                  value={form.personalizarResultados ? form.mostrarResultados : edicion?.mostrarResultados || 'al cerrar'}
                  onChange={(e) => setForm({ ...form, mostrarResultados: e.target.value })} aria-describedby="v-mr-ayuda">
                  {OPCIONES_MOSTRAR_RESULTADOS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <div id="v-mr-ayuda" className="form-text">
                  {form.personalizarResultados
                    ? DESCRIPCION_RESULTADOS[form.mostrarResultados]
                    : <>Hereda la configuración de la edición. <Link to="/panel/configuracion">Cambiarla en Configuración</Link>.</>}
                </div>
              </div>
              <div className="col-12">
                <fieldset>
                  <legend className="form-label mb-1">Cómo ve el público las opciones</legend>
                  <div className="row g-2" role="radiogroup">
                    {PRESENTACIONES_OPCIONES.map((p) => (
                      <div className="col-sm-6 col-lg-4" key={p.valor}>
                        <input type="radio" className="opcion-input" name="v-presentacion" id={`v-pres-${p.valor}`} checked={form.presentacionOpciones === p.valor} onChange={() => setForm({ ...form, presentacionOpciones: p.valor })} />
                        <label htmlFor={`v-pres-${p.valor}`} className="opcion-card presentacion-card">
                          <i className={`bi bi-${p.icono} fs-4 text-rojo`} aria-hidden="true"></i>
                          <span>
                            <span className="d-block fw-semibold">{p.etiqueta}</span>
                            <span className="d-block small text-secondary-flv">{p.descripcion}</span>
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>
                  <p className="form-text mb-0">Elegida: {presentacionElegida.etiqueta}.</p>
                </fieldset>
              </div>
              <div className="col-12">
                <div className="form-check form-switch">
                  <input id="v-pub" className={`form-check-input ${errores.publicada ? 'is-invalid' : ''}`} type="checkbox" role="switch" checked={form.publicada} disabled={publicacionBloqueada} onChange={(e) => setForm({ ...form, publicada: e.target.checked })} aria-describedby="v-pub-ayuda" />
                  <label className="form-check-label" htmlFor="v-pub">Publicar votación (visible al público)</label>
                  {errores.publicada && <div className="invalid-feedback d-block" role="alert">{errores.publicada}</div>}
                  <div id="v-pub-ayuda" className="form-text">
                    {publicacionBloqueada
                      ? AVISO_ABIERTA
                      : `${form.id ? `Opciones registradas: ${numOpciones(form.id)}.` : 'Las votaciones nuevas se crean como borrador.'} Se requieren al menos 2 opciones para publicar.`}
                  </div>
                </div>
              </div>
            </div>
          </form>
        )}
      </Modal>

      <FormularioOpcion
        opcion={formOpcion?.opcion || null}
        votacion={formOpcion?.votacion}
        onCerrar={() => setFormOpcion(null)}
        onGuardada={(texto) => setMensaje({ tipo: 'success', texto })}
      />

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
              <button className="btn btn-peligro" disabled={procesando} onClick={() => eliminar(aEliminar)}>Eliminar</button>
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
