import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import { useEdicionAdmin } from '../../context/EdicionAdmin.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import { PRESENTACIONES_CATEGORIAS } from '../../data/presentaciones.js';
import { DESCRIPCION_RESULTADOS } from '../../utils/helpers.js';
import { DIAS_VISIBLE_CERRADAS } from '../../utils/visibilidad.js';

const SECCIONES = [
  { id: 'resultados', label: 'Resultados', icono: 'bar-chart', descripcion: 'Cuándo ve el público los resultados de la edición.' },
  { id: 'visibilidad', label: 'Votaciones cerradas', icono: 'eye', descripcion: 'Cuánto tiempo siguen en el sitio después de cerrar.' },
  { id: 'presentacion', label: 'Presentación', icono: 'grid', descripcion: 'Cómo se muestran las categorías y el inicio.' },
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
  const { configuracion, guardarConfiguracion, guardarEntidad } = useApp();
  const { edicion, votaciones, categorias } = useEdicionAdmin();
  const [seccion, setSeccion] = useState('resultados');
  const [dias, setDias] = useState(String(configuracion?.diasVisibleCerradas ?? DIAS_VISIBLE_CERRADAS));
  const [estado, setEstado] = useState(null);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => setDias(String(configuracion?.diasVisibleCerradas ?? DIAS_VISIBLE_CERRADAS)), [configuracion?.diasVisibleCerradas]);

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
    if (n === (configuracion?.diasVisibleCerradas ?? DIAS_VISIBLE_CERRADAS)) return;
    guardarSitio({ diasVisibleCerradas: n }, n === 0 ? 'Las votaciones cerradas se ocultan al cerrar.' : `Las votaciones cerradas se verán ${n} ${n === 1 ? 'día' : 'días'} después del cierre.`);
  };

  const personalizadas = votaciones.filter((v) => v.personalizarResultados);
  const categoriaDe = (id) => categorias.find((c) => c.id === id)?.nombre;
  const actual = SECCIONES.find((s) => s.id === seccion);

  const restablecer = () => {
    if (seccion === 'resultados') guardarEdicion({ mostrarResultados: 'al cerrar' }, 'Resultados restablecidos: al cerrar.', 'Restableció la visibilidad de resultados');
    if (seccion === 'visibilidad') guardarSitio({ diasVisibleCerradas: DIAS_VISIBLE_CERRADAS }, `Restablecido: ${DIAS_VISIBLE_CERRADAS} días.`);
    if (seccion === 'presentacion') {
      guardar(async () => {
        const r = await guardarEntidad('ediciones', { id: edicion.id, presentacionCategorias: 'tarjetas' }, 'Restableció la presentación de categorías');
        return r.ok ? guardarConfiguracion({ ...configuracion, modoBanner: 'carrusel' }) : r;
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
            <Fila titulo="Días visibles después del cierre" descripcion="El sitio muestra las votaciones programadas y abiertas. Las cerradas siguen visibles estos días; con 0 se ocultan al cerrar. Las categorías de ediciones cerradas no se muestran. Aplica a todas las ediciones.">
              <div className="d-flex flex-wrap align-items-center gap-3">
                <input type="range" className="form-range flex-grow-1" style={{ maxWidth: '28rem' }} min="0" max="60" value={Math.min(Number(dias) || 0, 60)}
                  onChange={(e) => setDias(e.target.value)} onMouseUp={guardarDias} onTouchEnd={guardarDias} onKeyUp={guardarDias} aria-label="Días visibles después del cierre" disabled={procesando} />
                <div className="input-group" style={{ width: '9rem' }}>
                  <input id="cfg-dias" type="number" min="0" max="365" className="form-control" value={dias} onChange={(e) => setDias(e.target.value)} onBlur={guardarDias}
                    onKeyDown={(e) => e.key === 'Enter' && guardarDias()} aria-label="Días (número)" disabled={procesando} />
                  <span className="input-group-text">días</span>
                </div>
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
