// Registros del sistema (RF-19, CU-14, RNF-12): errores del servidor y de la web. Misma pantalla que portal/panel/registros.html.
import { useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader.jsx';
import Paginador from '../../components/Paginador.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { formatearFechaHora } from '../../utils/helpers.js';
import { descargarBlob } from '../../utils/exportar.js';

// Misma pantalla que la versión Django (portal/templates/portal/panel/registros.html)
const NIVELES = { CRITICAL: 'Crítico', ERROR: 'Error', WARNING: 'Aviso' };
const FUENTES = { servidor: 'Servidor', web: 'Web (navegador)' };
const PERIODOS = { 1: 'Últimas 24 horas', 7: 'Últimos 7 días', 30: 'Últimos 30 días' };
const SIN_FILTROS = { q: '', nivel: '', fuente: '', dias: '' };

const CLASE_NIVEL = { WARNING: 'text-bg-warning', CRITICAL: 'text-bg-dark' };
const recortar = (texto, max) => (texto && texto.length > max ? `${texto.slice(0, max - 1)}…` : texto || '');
const miles = (n) => Number(n || 0).toLocaleString('es-CO');

/** Registro en la forma de la API (los mismos campos que descarga la versión Django). */
const haciaJson = (r) => ({
  id: r.id, fecha_hora: r.fechaHora, nivel: r.nivel, fuente: r.fuente, origen: r.origen, mensaje: r.mensaje,
  excepcion: r.excepcion, ubicacion: r.ubicacion, archivo: r.archivo, linea: r.linea, funcion: r.funcion, traza: r.traza,
  metodo: r.metodo, ruta: r.ruta, estado_http: r.estadoHttp, id_solicitud: r.referencia, usuario: r.usuario, ip: r.ip,
  navegador: r.navegador, detalle: r.detalle,
});

/** Texto plano: un bloque por registro separado por una línea de guiones (como la descarga TXT de Django). */
function haciaTexto(registros) {
  return registros.map((r) => {
    const cabecera = `[${r.fechaHora}] ${r.nivel} ${r.fuente} ${r.origen} ref=${r.referencia || '-'}`;
    const peticion = `${r.metodo} ${r.ruta} · ${r.usuario || 'anónimo'} · ${r.ip || '-'}`.trim().replace(/^[\s·]+|[\s·]+$/g, '');
    return [cabecera, r.mensaje, r.ubicacion, peticion, r.traza].filter(Boolean).join('\n');
  }).join(`\n\n${'-'.repeat(80)}\n\n`);
}

function descargar(registros, formato) {
  const ahora = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const marca = `${ahora.getFullYear()}${pad(ahora.getMonth() + 1)}${pad(ahora.getDate())}-${pad(ahora.getHours())}${pad(ahora.getMinutes())}`;
  const blob = formato === 'json'
    ? new Blob([JSON.stringify(registros.map(haciaJson), null, 2)], { type: 'application/json' })
    : new Blob([haciaTexto(registros)], { type: 'text/plain;charset=utf-8' });
  descargarBlob(`registros-${marca}.${formato}`, blob);
}

function Resumen({ resumen }) {
  const tarjetas = [
    { titulo: 'Errores en 24 horas', valor: resumen ? miles(resumen.errores24h) : '…', clase: `h3${resumen?.errores24h ? ' text-rojo' : ''}` },
    { titulo: 'Errores en 7 días', valor: resumen ? miles(resumen.errores7d) : '…', clase: 'h3' },
    { titulo: 'Último error', valor: resumen ? formatearFechaHora(resumen.ultimoError) : '…', clase: 'h6' },
  ];
  return (
    <div className="row g-3 mb-3">
      {tarjetas.map((t) => (
        <div className="col-sm-4" key={t.titulo}>
          <div className="card-flv p-3 h-100">
            <p className="small text-secondary-flv mb-1">{t.titulo}</p>
            <p className={`${t.clase} mb-0`}>{t.valor}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Registro({ r }) {
  const titulo = recortar(r.excepcion || r.mensaje, 180);
  return (
    <li className="card-flv p-0 mb-2">
      <details>
        <summary className="p-3 d-flex flex-wrap gap-2 align-items-start">
          <span className={`badge ${CLASE_NIVEL[r.nivel] || 'text-bg-danger'}`}>{NIVELES[r.nivel] || r.nivel}</span>
          <span className="badge text-bg-light border">
            <i className={`bi ${r.fuente === 'web' ? 'bi-browser-chrome' : 'bi-hdd-stack'} me-1`} aria-hidden="true"></i>{FUENTES[r.fuente] || r.fuente}
          </span>
          <span className="flex-grow-1" style={{ minWidth: '14rem' }}>
            <span className="d-block fw-semibold text-break">{titulo}</span>
            <span className="d-block small text-secondary-flv text-break">
              {r.ubicacion && <><code>{r.ubicacion}</code> · </>}
              {r.ruta && `${r.metodo} ${recortar(r.ruta, 80)}`}
            </span>
          </span>
          <span className="small text-secondary-flv text-nowrap">{formatearFechaHora(r.fechaHora)}</span>
        </summary>
        <div className="px-3 pb-3 border-top pt-2">
          <dl className="row small mb-2">
            <dt className="col-sm-3">Referencia</dt>
            <dd className="col-sm-9"><code className="user-select-all">{r.referencia || '—'}</code></dd>
            <dt className="col-sm-3">Mensaje</dt>
            <dd className="col-sm-9 text-break">{r.mensaje}</dd>
            <dt className="col-sm-3">Dónde falló</dt>
            <dd className="col-sm-9 text-break">{r.ubicacion ? <code>{r.ubicacion}</code> : '—'}</dd>
            <dt className="col-sm-3">Petición</dt>
            <dd className="col-sm-9 text-break">
              {r.ruta ? `${r.metodo} ${r.ruta}${r.estadoHttp ? ` → ${r.estadoHttp}` : ''}` : '— (fuera de una petición)'}
            </dd>
            {r.detalle?.url && (
              <>
                <dt className="col-sm-3">Página de la web</dt>
                <dd className="col-sm-9 text-break">{r.detalle.url}</dd>
              </>
            )}
            <dt className="col-sm-3">Usuario</dt>
            <dd className="col-sm-9 text-break">{r.usuario || 'anónimo'} · IP {r.ip || '—'}</dd>
            {r.navegador && (
              <>
                <dt className="col-sm-3">Navegador</dt>
                <dd className="col-sm-9 text-break small">{r.navegador}</dd>
              </>
            )}
            <dt className="col-sm-3">Origen</dt>
            <dd className="col-sm-9"><code>{r.origen}</code></dd>
          </dl>
          {r.traza && (
            <>
              <p className="small fw-semibold mb-1">Traza</p>
              <pre className="registro-traza small mb-0" tabIndex={0} aria-label="Traza del error">{r.traza}</pre>
            </>
          )}
        </div>
      </details>
    </li>
  );
}

/** Registros del sistema: errores del servidor y de la web con su traza (permiso registros.ver). */
export default function AdminRegistros() {
  const { cargarRegistros, obtenerResumenRegistros, provocarErrorPrueba, modo } = useApp();
  const [filtros, setFiltros] = useState(SIN_FILTROS);
  const [pagina, setPagina] = useState(1);
  const [recarga, setRecarga] = useState(0);
  const [resumen, setResumen] = useState(null);
  const [estado, setEstado] = useState({ cargando: true, registros: [], total: 0, hayMas: false, error: '' });
  const [prueba, setPrueba] = useState({ enviando: false, referencia: '', error: '' });
  const hayFiltros = Object.values(filtros).some(Boolean);

  useEffect(() => {
    let vigente = true;
    obtenerResumenRegistros().then((r) => vigente && setResumen(r.ok ? r : { errores24h: 0, errores7d: 0, ultimoError: null }));
    return () => {
      vigente = false;
    };
  }, [obtenerResumenRegistros, recarga]);

  useEffect(() => {
    let vigente = true;
    setEstado((e) => ({ ...e, cargando: true }));
    // Espera a que se deje de escribir en «Buscar» antes de consultar
    const t = setTimeout(() => {
      cargarRegistros(pagina, { ...filtros, q: filtros.q.trim() }).then((r) => {
        if (!vigente) return;
        setEstado(r.ok ? { cargando: false, ...r, error: '' } : { cargando: false, registros: [], total: 0, hayMas: false, error: r.error });
      });
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, filtros, recarga]);

  const cambiar = (campo) => (e) => {
    setFiltros((f) => ({ ...f, [campo]: e.target.value }));
    setPagina(1);
  };
  const limpiar = () => {
    setFiltros(SIN_FILTROS);
    setPagina(1);
  };

  const probar = async () => {
    setPrueba({ enviando: true, referencia: '', error: '' });
    const r = await provocarErrorPrueba();
    setPrueba({ enviando: false, referencia: r.ok ? r.referencia : '', error: r.ok ? '' : r.error });
    if (r.ok) setRecarga((n) => n + 1);
  };
  const buscarReferencia = () => {
    setFiltros({ ...SIN_FILTROS, q: prueba.referencia });
    setPagina(1);
  };

  const { cargando, registros, total, hayMas, error, ilustrativos } = estado;
  const paginador = (posicion) => (
    <Paginador
      posicion={posicion}
      pagina={pagina}
      hayMas={hayMas}
      cargando={cargando}
      onCambio={setPagina}
      etiqueta="los registros"
      resumen={`${miles(total)} ${total === 1 ? 'registro' : 'registros'}`}
    />
  );

  return (
    <>
      <PageHeader
        titulo="Logs"
        subtitulo={<>Errores del servidor y de la web: qué falló, en qué archivo y línea, en qué página y a quién le pasó. Para buscar el error que alguien reporta, escribe la <strong>referencia</strong> que le mostró la pantalla de error.</>}
      >
        <button type="button" className="btn btn-sm btn-outline-primary" onClick={probar} disabled={prueba.enviando} aria-describedby="reg-prueba-estado">
          <i className="bi bi-bug me-1" aria-hidden="true"></i>{prueba.enviando ? 'Provocando…' : 'Provocar un error de prueba'}
        </button>
      </PageHeader>

      <div id="reg-prueba-estado" aria-live="polite">
        {prueba.referencia && (
          <div className="alert alert-success d-flex flex-wrap align-items-center gap-2" role="status">
            <span className="flex-grow-1">
              <i className="bi bi-check-circle me-1" aria-hidden="true"></i>Se provocó el error de prueba y quedó registrado. Referencia: <code className="user-select-all">{prueba.referencia}</code>
            </span>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={buscarReferencia}>
              <i className="bi bi-search me-1" aria-hidden="true"></i>Ver este registro
            </button>
          </div>
        )}
        {prueba.error && <div className="alert alert-secondary" role="status">{prueba.error}</div>}
      </div>

      {(ilustrativos || modo === 'mock') && (
        <div className="alert alert-secondary small py-2" role="note">
          <i className="bi bi-info-circle me-1" aria-hidden="true"></i>Modo demostración: estos registros son <strong>ejemplos ilustrativos y ficticios</strong>. Con la web conectada a la API se muestran los errores reales del servidor y de la web.
        </div>
      )}

      <Resumen resumen={resumen} />

      <form className="card-flv p-3 mb-3" role="search" onSubmit={(e) => e.preventDefault()}>
        <div className="row g-2 align-items-end">
          <div className="col-md-4">
            <label htmlFor="reg-buscar" className="form-label small mb-1">Buscar</label>
            <input id="reg-buscar" type="search" className="form-control form-control-sm" placeholder="Referencia, mensaje, archivo, ruta o correo" value={filtros.q} onChange={cambiar('q')} />
          </div>
          <div className="col-sm-4 col-md-2">
            <label htmlFor="reg-nivel" className="form-label small mb-1">Nivel</label>
            <select id="reg-nivel" className="form-select form-select-sm" value={filtros.nivel} onChange={cambiar('nivel')}>
              <option value="">Todos</option>
              {Object.entries(NIVELES).map(([v, e]) => <option key={v} value={v}>{e}</option>)}
            </select>
          </div>
          <div className="col-sm-4 col-md-2">
            <label htmlFor="reg-fuente" className="form-label small mb-1">Dónde</label>
            <select id="reg-fuente" className="form-select form-select-sm" value={filtros.fuente} onChange={cambiar('fuente')}>
              <option value="">Todo</option>
              {Object.entries(FUENTES).map(([v, e]) => <option key={v} value={v}>{e}</option>)}
            </select>
          </div>
          <div className="col-sm-4 col-md-2">
            <label htmlFor="reg-dias" className="form-label small mb-1">Periodo</label>
            <select id="reg-dias" className="form-select form-select-sm" value={filtros.dias} onChange={cambiar('dias')}>
              <option value="">Todo</option>
              {Object.entries(PERIODOS).map(([v, e]) => <option key={v} value={v}>{e}</option>)}
            </select>
          </div>
          <div className="col-md-2 d-flex gap-2">
            {hayFiltros && <button type="button" className="btn btn-sm btn-link" onClick={limpiar}>Limpiar</button>}
          </div>
        </div>
      </form>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      {registros.length > 0 ? (
        <>
          <div className="d-flex flex-wrap gap-2 justify-content-end mb-2">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => descargar(registros, 'txt')}>
              <i className="bi bi-file-earmark-text me-1" aria-hidden="true"></i>Descargar TXT
            </button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => descargar(registros, 'json')}>
              <i className="bi bi-filetype-json me-1" aria-hidden="true"></i>Descargar JSON
            </button>
          </div>
          {paginador('arriba')}
          <ul className="list-unstyled mb-0 registros-lista" aria-busy={cargando}>
            {registros.map((r) => <Registro key={r.id} r={r} />)}
          </ul>
          {paginador('abajo')}
          <p className="small text-secondary-flv mt-2 mb-0">
            La descarga incluye los {miles(registros.length)} registros de esta página con los filtros aplicados. Se conservan los de los últimos días configurados en el servidor (LOG_DIAS_RETENCION).
          </p>
        </>
      ) : (
        !error && (
          <div className="card-flv p-4 text-center" aria-live="polite">
            {cargando ? 'Cargando…' : hayFiltros ? 'No hay registros con ese filtro.' : (
              <><i className="bi bi-patch-check text-success fs-3 d-block mb-1" aria-hidden="true"></i>Sin errores registrados.</>
            )}
          </div>
        )
      )}
    </>
  );
}
