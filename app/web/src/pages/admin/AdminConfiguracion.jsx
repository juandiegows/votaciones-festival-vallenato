import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import { useEdicionAdmin } from '../../context/EdicionAdmin.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import { PRESENTACIONES_CATEGORIAS, PRESENTACIONES_OPCIONES, presentacionOpciones } from '../../data/presentaciones.js';
import { DESCRIPCION_RESULTADOS } from '../../utils/helpers.js';
import { DIAS_VISIBLE_CERRADAS, diasVisibleCerradas } from '../../utils/visibilidad.js';

const SECCIONES = [
  { id: 'votacion', label: 'Votación', icono: 'check2-square', descripcion: 'Votos por usuario y pausa de emergencia de la edición.' },
  { id: 'resultados', label: 'Resultados', icono: 'bar-chart', descripcion: 'Cuándo ve el público los resultados de la edición.' },
  { id: 'visibilidad', label: 'Votaciones cerradas', icono: 'eye', descripcion: 'Cuánto tiempo siguen en el sitio después de cerrar.' },
  { id: 'registro', label: 'Registro', icono: 'person-vcard', descripcion: 'Qué datos se piden a quien crea una cuenta para votar.' },
  { id: 'presentacion', label: 'Presentación', icono: 'grid', descripcion: 'Cómo ve el público las categorías, las opciones de cada votación y el inicio.' },
];

const OPCIONES_RESULTADOS = [
  { valor: 'en tiempo real', etiqueta: 'En tiempo real', icono: 'broadcast' },
  { valor: 'al cerrar', etiqueta: 'Al cerrar', icono: 'lock' },
  { valor: 'no publicar', etiqueta: 'No publicar', icono: 'eye-slash' },
];

const MODOS_BANNER = [
  { valor: 'carrusel', etiqueta: 'Carrusel', icono: 'collection-play', descripcion: 'Todos los banners activos rotando.' },
  { valor: 'fijo', etiqueta: 'Fijo', icono: 'image', descripcion: 'Solo el primer banner activo.' },
];

/** Grupo de tarjetas para elegir una sola opción (radio accesible). */
function Opciones({ nombre, opciones, valor, onCambio, deshabilitado, columnas = 'col-sm-4' }) {
  return (
    <div className="row g-2" role="radiogroup">
      {opciones.map((o) => (
        <div className={columnas} key={o.valor}>
          <input type="radio" className="btn-check" name={nombre} id={`${nombre}-${o.valor}`} checked={valor === o.valor} disabled={deshabilitado} onChange={() => onCambio(o.valor)} />
          <label className="opcion-config" htmlFor={`${nombre}-${o.valor}`}>
            <i className={`bi bi-${o.icono}`} aria-hidden="true"></i>
            <span className="fw-semibold">{o.etiqueta}</span>
            {o.descripcion && <span className="small opcion-config-desc">{o.descripcion}</span>}
          </label>
        </div>
      ))}
    </div>
  );
}

function Fila({ titulo, descripcion, children, id }) {
  return (
    <div className="fila-config">
      <div className="mb-2">
        <h3 className="h6 mb-0" id={id}>{titulo}</h3>
        {descripcion && <p className="small text-secondary-flv mb-0">{descripcion}</p>}
      </div>
      {children}
    </div>
  );
}

// Configuración del sitio público: visibilidad de resultados (por edición), votaciones cerradas y presentación
export default function AdminConfiguracion() {
  const { configuracion, guardarConfiguracion, guardarEntidad, reemplazarColeccion, publicarResultadosEdicion, votaciones: todasLasVotaciones } = useApp();
  const { edicion, votaciones, categorias } = useEdicionAdmin();
  const [seccion, setSeccion] = useState('votacion');
  const [votos, setVotos] = useState(String(edicion?.votosPorUsuario ?? 1));
  useEffect(() => setVotos(String(edicion?.votosPorUsuario ?? 1)), [edicion?.votosPorUsuario]);
  const diasGuardados = diasVisibleCerradas(configuracion);
  const siempre = diasGuardados === null;
  const [dias, setDias] = useState(String(diasGuardados ?? DIAS_VISIBLE_CERRADAS));
  const [estado, setEstado] = useState(null);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => setDias(String(diasGuardados ?? DIAS_VISIBLE_CERRADAS)), [diasGuardados]);

  // Cada cambio se guarda al momento
  const guardar = async (accion, exito) => {
    setProcesando(true);
    setEstado({ tipo: 'info', texto: 'Guardando…' });
    const r = await accion();
    setProcesando(false);
    setEstado(r.ok ? { tipo: 'success', texto: exito } : { tipo: 'danger', texto: r.error || 'No fue posible guardar.' });
  };

  const guardarEdicion = (cambios, exito, auditoria) =>
    guardar(() => guardarEntidad('ediciones', { id: edicion.id, ...cambios }, auditoria), exito);

  const guardarSitio = (cambios, exito) => guardar(() => guardarConfiguracion({ ...configuracion, ...cambios }), exito);

  const guardarDias = () => {
    const n = Number(dias);
    if (!/^\d+$/.test(dias) || n > 365) {
      setEstado({ tipo: 'danger', texto: 'Escribe un número de días entre 0 y 365.' });
      return;
    }
    if (n === diasGuardados) return;
    guardarSitio({ diasVisibleCerradas: n }, n === 0 ? 'Las votaciones cerradas se ocultan al cerrar.' : `Las votaciones cerradas se verán ${n} ${n === 1 ? 'día' : 'días'} después del cierre.`);
  };

  const personalizadas = votaciones.filter((v) => v.personalizarResultados);
  const votosPropios = votaciones.filter((v) => v.personalizarVotos);
  const publicadas = votaciones.filter((v) => v.resultadosPublicados).length;

  const guardarVotos = () => {
    const n = Number(votos);
    if (!/^\d+$/.test(votos) || n < 1 || n > 5) {
      setEstado({ tipo: 'danger', texto: 'Los votos por usuario deben estar entre 1 y 5.' });
      return;
    }
    if (n === (edicion.votosPorUsuario ?? 1)) return;
    guardarEdicion({ votosPorUsuario: n }, `Votos por usuario de la edición: ${n}.`, `Cambió los votos por usuario de "${edicion.nombre}" a ${n}`);
  };

  const pausar = (pausada) => {
    if (pausada && !window.confirm(`¿Pausar todas las votaciones de ${edicion.nombre}? Nadie podrá votar hasta que la reanudes.`)) return;
    guardarEdicion(
      { votacionesPausadas: pausada },
      pausada ? 'Votaciones en pausa: nadie puede votar en esta edición.' : 'Votaciones reanudadas.',
      `${pausada ? 'Pausó' : 'Reanudó'} las votaciones de "${edicion.nombre}"`,
    );
  };

  const publicarTodas = (publicar) =>
    guardar(() => publicarResultadosEdicion(edicion.id, publicar),
      publicar ? 'Resultados de todas las votaciones publicados.' : 'Publicación manual retirada en todas las votaciones.');
  const presentacionesUsadas = new Set(votaciones.map((v) => v.presentacionOpciones || 'tarjetas'));
  const presentacionComun = presentacionesUsadas.size === 1 ? [...presentacionesUsadas][0] : null;

  // Una sola operación: la API guarda solo las votaciones que cambian y recarga una vez
  const presentarOpcionesComo = (valor, auditoria) => {
    const ids = new Set(votaciones.map((v) => v.id));
    const lista = todasLasVotaciones.map((v) => (ids.has(v.id) ? { ...v, presentacionOpciones: valor } : v));
    return reemplazarColeccion('votaciones', lista, auditoria);
  };

  const aplicarATodas = (valor) => {
    const pendientes = votaciones.filter((v) => (v.presentacionOpciones || 'tarjetas') !== valor);
    const etiqueta = presentacionOpciones(valor).etiqueta;
    guardar(() => presentarOpcionesComo(valor, `Aplicó la presentación de opciones "${etiqueta}" a las votaciones de "${edicion.nombre}"`), `Opciones de ${pendientes.length === votaciones.length ? 'todas las votaciones' : `${pendientes.length} votación(es)`}: ${etiqueta}.`);
  };

  const cambiarPresentacionVotacion = (v, valor) =>
    guardar(
      () => guardarEntidad('votaciones', { id: v.id, presentacionOpciones: valor }, `Cambió la presentación de opciones de "${v.titulo}" a "${presentacionOpciones(valor).etiqueta}"`),
      `«${v.titulo}»: ${presentacionOpciones(valor).etiqueta}.`,
    );
  const categoriaDe = (id) => categorias.find((c) => c.id === id)?.nombre;
  const actual = SECCIONES.find((s) => s.id === seccion);

  const restablecer = () => {
    if (seccion === 'votacion') guardarEdicion({ votosPorUsuario: 1, votacionesPausadas: false }, 'Votación restablecida: 1 voto por usuario, sin pausa.', 'Restableció la configuración de votación');
    if (seccion === 'resultados') guardarEdicion({ mostrarResultados: 'al cerrar' }, 'Resultados restablecidos: al cerrar.', 'Restableció la visibilidad de resultados');
    if (seccion === 'visibilidad') guardarSitio({ diasVisibleCerradas: DIAS_VISIBLE_CERRADAS }, `Restablecido: ${DIAS_VISIBLE_CERRADAS} días.`);
    if (seccion === 'registro') guardarSitio({ pedirDocumento: false }, 'Registro restablecido: solo con correo confirmado.');
    if (seccion === 'presentacion') {
      guardar(async () => {
        const r = await guardarEntidad('ediciones', { id: edicion.id, presentacionCategorias: 'tarjetas' }, 'Restableció la presentación de categorías');
        if (!r.ok) return r;
        const rv = await presentarOpcionesComo('tarjetas', `Restableció la presentación de opciones de "${edicion.nombre}"`);
        if (!rv.ok) return rv;
        return guardarConfiguracion({ ...configuracion, modoBanner: 'carrusel', mostrarTotalVotos: false });
      }, 'Presentación restablecida.');
    }
  };

  if (!edicion) {
    return (
      <>
        <PageHeader titulo="Configuración" />
        <div className="alert alert-info">Crea una edición en «Ediciones» para configurar el sitio.</div>
      </>
    );
  }

  return (
    <>
      <PageHeader titulo="Configuración" subtitulo={`Cómo se comporta el sitio público · ${edicion.nombre}. Los cambios se guardan automáticamente.`} />
      <div className="configuracion-admin">
        <nav aria-label="Secciones de configuración">
          <ul className="nav nav-pills flex-row flex-md-column flex-nowrap gap-1 config-secciones">
            {SECCIONES.map((s) => (
              <li className="nav-item" key={s.id}>
                <button type="button" className={`nav-link ${seccion === s.id ? 'active' : ''}`} aria-current={seccion === s.id ? 'true' : undefined} onClick={() => { setSeccion(s.id); setEstado(null); }}>
                  <i className={`bi bi-${s.icono} me-2`} aria-hidden="true"></i>{s.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <section className="card-flv p-3 p-md-4" aria-labelledby="titulo-seccion">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
            <div>
              <h2 id="titulo-seccion" className="h5 mb-0"><i className={`bi bi-${actual.icono} me-2 text-rojo`} aria-hidden="true"></i>{actual.label}</h2>
              <p className="small text-secondary-flv mb-0">{actual.descripcion}</p>
            </div>
            <button type="button" className="btn btn-sm btn-link text-reset" onClick={restablecer} disabled={procesando}>
              <i className="bi bi-arrow-counterclockwise me-1" aria-hidden="true"></i>Restablecer sección
            </button>
          </div>
          <p className="small mb-0 estado-config" role="status" aria-live="polite">
            {estado && <span className={`text-${estado.tipo === 'info' ? 'secondary' : estado.tipo}`}>{estado.texto}</span>}
          </p>

          {seccion === 'votacion' && (
            <>
              <Fila titulo={`Recepción de votos · ${edicion.anio}`} descripcion="Pausa de emergencia: mientras esté en pausa nadie puede votar en ninguna votación de la edición. Las fechas no cambian.">
                <Opciones
                  nombre="cfg-pausa"
                  columnas="col-sm-6"
                  opciones={[
                    { valor: 'activa', etiqueta: 'Recibiendo votos', icono: 'play-circle', descripcion: 'Se vota según las fechas de cada votación.' },
                    { valor: 'pausada', etiqueta: 'En pausa', icono: 'pause-circle', descripcion: 'Nadie puede votar hasta reanudar.' },
                  ]}
                  valor={edicion.votacionesPausadas ? 'pausada' : 'activa'}
                  deshabilitado={procesando}
                  onCambio={(v) => pausar(v === 'pausada')}
                />
              </Fila>
              <Fila titulo="Votos por usuario" descripcion="Cuántas veces puede votar cada persona en cada votación de la edición, salvo las que personalizan su propio límite (pendiente de validación con la Fundación, P-03).">
                <div className="input-group mb-2" style={{ width: '12rem' }}>
                  <input id="cfg-votos" type="number" min="1" max="5" className="form-control" value={votos} onChange={(e) => setVotos(e.target.value)} onBlur={guardarVotos}
                    onKeyDown={(e) => e.key === 'Enter' && guardarVotos()} aria-label="Votos por usuario de la edición" disabled={procesando} />
                  <span className="input-group-text">{Number(votos) === 1 ? 'voto' : 'votos'}</span>
                </div>
                {votosPropios.length === 0 ? (
                  <p className="small mb-0"><i className="bi bi-check2-circle me-1 text-success" aria-hidden="true"></i>Todas las votaciones usan el límite de la edición.</p>
                ) : (
                  <ul className="list-unstyled lista-compacta mb-0" aria-label="Votaciones con límite propio">
                    {votosPropios.map((v) => (
                      <li key={v.id}>
                        <span className="flex-grow-1 text-truncate"><strong>{v.titulo}</strong> <span className="text-secondary-flv">· {categoriaDe(v.categoriaId)}</span></span>
                        <span className="badge text-bg-light border">{v.votosPorUsuario} {Number(v.votosPorUsuario) === 1 ? 'voto' : 'votos'}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Fila>
            </>
          )}

          {seccion === 'resultados' && (
            <>
              <Fila titulo={`Resultados de la edición ${edicion.anio}`} descripcion="Aplica a todas las votaciones de la edición, salvo las que personalizan su propia configuración.">
                <Opciones
                  nombre="cfg-resultados"
                  opciones={OPCIONES_RESULTADOS.map((o) => ({ ...o, descripcion: DESCRIPCION_RESULTADOS[o.valor] }))}
                  valor={edicion.mostrarResultados || 'al cerrar'}
                  deshabilitado={procesando}
                  onCambio={(v) => guardarEdicion({ mostrarResultados: v }, `Resultados de la edición: ${v}.`, `Cambió la visibilidad de resultados de "${edicion.nombre}" a "${v}"`)}
                />
              </Fila>
              <Fila titulo="Publicar resultados de toda la edición" descripcion="Publicación manual: muestra al público los resultados de todas las votaciones publicadas de la edición sin importar la configuración anterior (por ejemplo, al terminar el Festival).">
                <p className="small mb-2">{publicadas} de {votaciones.length} votaciones tienen la publicación manual activa.</p>
                <div className="d-flex flex-wrap gap-2">
                  <button type="button" className="btn btn-primary btn-sm" disabled={procesando || !votaciones.length || publicadas === votaciones.length} onClick={() => publicarTodas(true)}>
                    <i className="bi bi-megaphone me-1" aria-hidden="true"></i>Publicar todas
                  </button>
                  <button type="button" className="btn btn-outline-secondary btn-sm" disabled={procesando || publicadas === 0} onClick={() => publicarTodas(false)}>
                    <i className="bi bi-eye-slash me-1" aria-hidden="true"></i>Retirar publicación
                  </button>
                </div>
              </Fila>
              <Fila titulo="Votaciones con configuración propia" descripcion="Estas no toman la de la edición. Se cambia en el formulario de cada votación (casilla «Personalizar»).">
                {personalizadas.length === 0 ? (
                  <p className="small mb-0"><i className="bi bi-check2-circle me-1 text-success" aria-hidden="true"></i>Todas las votaciones usan la configuración de la edición.</p>
                ) : (
                  <ul className="list-unstyled lista-compacta mb-0">
                    {personalizadas.map((v) => (
                      <li key={v.id}>
                        <span className="flex-grow-1 text-truncate"><strong>{v.titulo}</strong> <span className="text-secondary-flv">· {categoriaDe(v.categoriaId)}</span></span>
                        <span className="badge text-bg-light border">{v.mostrarResultados}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <Link to="/panel/votaciones" className="small d-inline-block mt-2">Ir a votaciones</Link>
              </Fila>
            </>
          )}

          {seccion === 'visibilidad' && (
            <Fila titulo="Días visibles después del cierre" descripcion="El sitio muestra las votaciones programadas y abiertas. Las cerradas siguen visibles estos días (con 0 se ocultan al cerrar) o siempre. Las categorías de ediciones cerradas no se muestran. Aplica a todas las ediciones.">
              <div className="mb-3">
                <Opciones
                  nombre="cfg-cerradas"
                  columnas="col-sm-6"
                  opciones={[
                    { valor: 'dias', etiqueta: 'Por días', icono: 'calendar-range', descripcion: 'Se ocultan pasado el número de días que elijas.' },
                    { valor: 'siempre', etiqueta: 'Siempre visibles', icono: 'infinity', descripcion: 'Nunca se ocultan del sitio por haber cerrado.' },
                  ]}
                  valor={siempre ? 'siempre' : 'dias'}
                  deshabilitado={procesando}
                  onCambio={(v) => v === 'siempre'
                    ? guardarSitio({ diasVisibleCerradas: null }, 'Las votaciones cerradas se verán siempre.')
                    : guardarSitio({ diasVisibleCerradas: Number(dias) || DIAS_VISIBLE_CERRADAS }, `Las votaciones cerradas se verán ${Number(dias) || DIAS_VISIBLE_CERRADAS} días después del cierre.`)}
                />
              </div>
              {!siempre && (
              <div className="d-flex flex-wrap align-items-center gap-3">
                <input type="range" className="form-range flex-grow-1" style={{ maxWidth: '28rem' }} min="0" max="60" value={Math.min(Number(dias) || 0, 60)}
                  onChange={(e) => setDias(e.target.value)} onMouseUp={guardarDias} onTouchEnd={guardarDias} onKeyUp={guardarDias} aria-label="Días visibles después del cierre" disabled={procesando} />
                <div className="input-group" style={{ width: '9rem' }}>
                  <input id="cfg-dias" type="number" min="0" max="365" className="form-control" value={dias} onChange={(e) => setDias(e.target.value)} onBlur={guardarDias}
                    onKeyDown={(e) => e.key === 'Enter' && guardarDias()} aria-label="Días (número)" disabled={procesando} />
                  <span className="input-group-text">días</span>
                </div>
              </div>
              )}
            </Fila>
          )}

          {seccion === 'registro' && (
            <Fila
              id="cfg-documento-titulo"
              titulo="Documento de identidad"
              descripcion="Por defecto el registro es solo con correo confirmado. Si lo activas, quien se registre debe dar su tipo y número de documento (una cuenta por documento), y quien ya tenga cuenta sin documento lo completará antes de su próximo voto. Aplica a todo el sitio; pendiente de validación con la Fundación (P-01)."
            >
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  role="switch"
                  id="cfg-pedir-documento"
                  checked={!!configuracion?.pedirDocumento}
                  disabled={procesando}
                  aria-describedby="cfg-documento-titulo"
                  onChange={(e) => guardarSitio(
                    { pedirDocumento: e.target.checked },
                    e.target.checked
                      ? 'El registro pide documento; quienes no lo tengan lo completarán antes de votar.'
                      : 'El registro ya no pide documento.',
                  )}
                />
                <label className="form-check-label fw-semibold" htmlFor="cfg-pedir-documento">Pedir documento al registrarse</label>
              </div>
            </Fila>
          )}

          {seccion === 'presentacion' && (
            <>
              <Fila titulo={`Categorías de la edición ${edicion.anio}`} descripcion="Cómo ve el público la página de categorías de esta edición.">
                <Opciones
                  nombre="cfg-presentacion"
                  columnas="col-sm-6 col-xl-4"
                  opciones={PRESENTACIONES_CATEGORIAS}
                  valor={edicion.presentacionCategorias || 'tarjetas'}
                  deshabilitado={procesando}
                  onCambio={(v) => guardarEdicion({ presentacionCategorias: v }, `Categorías: ${PRESENTACIONES_CATEGORIAS.find((p) => p.valor === v).etiqueta}.`, `Cambió la presentación de categorías de "${edicion.nombre}"`)}
                />
              </Fila>
              <Fila titulo={`Opciones de las votaciones de ${edicion.anio}`} descripcion="Cómo ve el público las opciones al votar. Elige una para aplicarla a todas las votaciones de la edición, o cámbiala en cada una más abajo.">
                {votaciones.length === 0 ? (
                  <p className="small mb-0">Esta edición aún no tiene votaciones.</p>
                ) : (
                  <>
                    <Opciones
                      nombre="cfg-opciones"
                      columnas="col-sm-6 col-xl-4"
                      opciones={PRESENTACIONES_OPCIONES}
                      valor={presentacionComun}
                      deshabilitado={procesando}
                      onCambio={aplicarATodas}
                    />
                    {!presentacionComun && (
                      <p className="small text-secondary-flv mt-2 mb-0"><i className="bi bi-info-circle me-1" aria-hidden="true"></i>Las votaciones usan presentaciones distintas; elige una para igualarlas todas.</p>
                    )}
                    <ul className="list-unstyled lista-compacta mt-3 mb-0" aria-label="Presentación de opciones por votación">
                      {votaciones.map((v) => (
                        <li key={v.id}>
                          <span className="flex-grow-1 text-truncate"><strong>{v.titulo}</strong> <span className="text-secondary-flv">· {categoriaDe(v.categoriaId)}</span></span>
                          <label className="visually-hidden" htmlFor={`cfg-op-${v.id}`}>Presentación de opciones de {v.titulo}</label>
                          <select id={`cfg-op-${v.id}`} className="form-select form-select-sm" style={{ width: 'auto' }} value={v.presentacionOpciones || 'tarjetas'}
                            disabled={procesando} onChange={(e) => cambiarPresentacionVotacion(v, e.target.value)}>
                            {PRESENTACIONES_OPCIONES.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
                          </select>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Fila>
              <Fila titulo="Total de votos en el inicio" descripcion="Muestra al público, en las cifras del inicio, cuántos votos lleva la edición activa. Si se oculta, en su lugar se muestran las votaciones programadas.">
                <Opciones
                  nombre="cfg-total"
                  columnas="col-sm-6"
                  opciones={[
                    { valor: 'ocultar', etiqueta: 'Ocultar', icono: 'eye-slash', descripcion: 'El público no ve el total de votos.' },
                    { valor: 'mostrar', etiqueta: 'Mostrar', icono: '123', descripcion: 'El inicio muestra los votos registrados.' },
                  ]}
                  valor={configuracion?.mostrarTotalVotos ? 'mostrar' : 'ocultar'}
                  deshabilitado={procesando}
                  onCambio={(v) => guardarSitio({ mostrarTotalVotos: v === 'mostrar' }, v === 'mostrar' ? 'El inicio muestra el total de votos.' : 'El total de votos se oculta en el inicio.')}
                />
              </Fila>
              <Fila titulo="Banner del inicio" descripcion="Aplica a todo el sitio. Los banners se administran en «Banner de inicio».">
                <Opciones
                  nombre="cfg-banner"
                  columnas="col-sm-6"
                  opciones={MODOS_BANNER}
                  valor={configuracion?.modoBanner || 'carrusel'}
                  deshabilitado={procesando}
                  onCambio={(v) => guardarSitio({ modoBanner: v }, `Banner del inicio: ${v}.`)}
                />
              </Fila>
            </>
          )}
        </section>
      </div>
    </>
  );
}
