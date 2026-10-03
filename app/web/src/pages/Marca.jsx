import { Fragment, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import EstadoBadge from '../components/EstadoBadge.jsx';
import { useApp } from '../context/AppContext.jsx';
import {
  COLORES_BASE, ESTILOS_ALERTA, ESTILOS_BOTON, FORMAS_BOTON, GRUPOS_COLOR, PESOS_BOTON, ROLES_BOTON, TOKEN_PRIMARIO, TOKEN_SECUNDARIO,
  compactarMarca, contraste, cssAlertas, cssBoton, cssMarca, esHex, estadosBoton, hexARgb, mezclar, nivelWcag, normalizarMarca, textoLegible,
} from '../data/marca.js';

const fmt = (r) => `${r.toFixed(2).replace('.', ',')}:1`;
const NOMBRES = Object.fromEntries(GRUPOS_COLOR.flatMap((g) => g.colores.map((c) => [c.token, c.nombre])));

/** Selector de color: muestra nativa + campo HEX (solo confirma valores válidos) */
function CampoColor({ id, etiqueta, valor, onCambio, ocultarEtiqueta = false }) {
  const [texto, setTexto] = useState(valor);
  const [previo, setPrevio] = useState(valor);
  if (valor !== previo) {
    setPrevio(valor);
    setTexto(valor);
  }
  const cambiar = (v) => {
    setTexto(v);
    const hex = v.startsWith('#') ? v : `#${v}`;
    if (esHex(hex)) onCambio(hex.toUpperCase());
  };
  return (
    <div>
      <label className={ocultarEtiqueta ? 'visually-hidden' : 'form-label small mb-1'} htmlFor={id}>{etiqueta}</label>
      <div className="input-group input-group-sm campo-color">
        <input type="color" className="form-control form-control-color" value={valor.toLowerCase()} aria-label={`${etiqueta} (selector)`}
          onChange={(e) => onCambio(e.target.value.toUpperCase())} />
        <input id={id} className={`form-control font-monospace ${esHex(texto.startsWith('#') ? texto : `#${texto}`) ? '' : 'is-invalid'}`}
          value={texto} maxLength={7} spellCheck={false} onChange={(e) => cambiar(e.target.value.trim())} />
      </div>
    </div>
  );
}

function Swatch({ c, hex, onCambio }) {
  const ratioPar = contraste(hex, c.par);
  const modificado = hex !== COLORES_BASE[c.token];
  const textoMuestra = textoLegible(hex);
  return (
    <article className="swatch">
      <div className="swatch-color" style={{ background: hex, color: textoMuestra, borderBottom: '1px solid #E9E9E9' }}>
        {hex}
        {modificado && <span className="badge bg-light text-dark ms-auto">Modificado</span>}
      </div>
      <div className="p-3">
        <h4 className="h6 mb-1">{c.nombre}</h4>
        <p className="small mb-2"><code>{c.token}</code></p>
        <div className="d-flex align-items-end gap-2 mb-2">
          <div className="flex-grow-1">
            <CampoColor id={`c${c.token}`} etiqueta={`Color ${c.nombre}`} valor={hex} onCambio={onCambio} ocultarEtiqueta />
          </div>
          {modificado && (
            <button type="button" className="btn btn-sm btn-light" title="Volver al color de la marca" aria-label={`Restablecer ${c.nombre}`}
              onClick={() => onCambio(COLORES_BASE[c.token])}>
              <i className="bi bi-arrow-counterclockwise" aria-hidden="true"></i>
            </button>
          )}
        </div>
        <dl>
          <dt>RGB</dt>
          <dd>rgb({hexARgb(hex).join(', ')})</dd>
          <dt>Uso</dt>
          <dd>{c.uso}</dd>
          <dt>Contraste</dt>
          <dd>
            Blanco {fmt(contraste(hex, '#FFFFFF'))} · Negro {fmt(contraste(hex, '#000000'))}
          </dd>
          <dt>Par recomendado</dt>
          <dd className="mb-0 d-flex flex-wrap align-items-center gap-2">
            <span className="px-2 py-1 rounded fw-semibold" style={{ background: hex, color: c.par, border: '1px solid #ccc' }}>Aa {c.par}</span>
            <strong>{fmt(ratioPar)}</strong>
            <span className={`badge ${ratioPar >= 4.5 ? 'estado-abierta' : 'estado-cerrada'} badge-estado`}>{nivelWcag(ratioPar)}</span>
          </dd>
        </dl>
      </div>
    </article>
  );
}

/** Editor de un botón (primario o secundario) */
function EditorBoton({ rol, boton, colores, onCambio }) {
  const r = ROLES_BOTON[rol];
  const colorRol = colores[r.token];
  const c = boton.color || colorRol;
  const e = estadosBoton(boton, colorRol).normal;
  const fondo = e['--bs-btn-bg'] === 'transparent' ? '#FFFFFF' : e['--bs-btn-bg'];
  const ratio = contraste(fondo, e['--bs-btn-color']);
  const set = (cambios) => onCambio({ ...boton, ...cambios });
  return (
    <div className="card-flv p-3 p-md-4 h-100">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h3 className="h5 mb-0">{r.nombre}</h3>
        <button type="button" className={`btn ${rol === 'primario' ? 'btn-primary' : 'btn-outline-primary'}`}>Vista previa</button>
      </div>
      <p className="small text-secondary-flv">
        Se aplica a los botones <code>{r.selector}</code> de todo el sitio.
      </p>

      <fieldset className="mb-3">
        <legend className="form-label fw-semibold fs-6">Estilo</legend>
        <div className="row g-2">
          {ESTILOS_BOTON.map((s) => (
            <div className="col-6 col-xl-4" key={s.id}>
              <input type="radio" className="btn-check" name={`estilo-${rol}`} id={`estilo-${rol}-${s.id}`} checked={boton.estilo === s.id}
                onChange={() => set({ estilo: s.id })} />
              <label className="opcion-estilo" htmlFor={`estilo-${rol}-${s.id}`}>
                <span className={`btn btn-sm btn-muestra-${rol}-${s.id}`} aria-hidden="true">Votar</span>
                <span className="fw-semibold small">{s.nombre}</span>
                <span className="opcion-config-desc small">{s.desc}</span>
              </label>
            </div>
          ))}
        </div>
      </fieldset>

      <div className="row g-3 mb-3">
        <div className="col-sm-6">
          <div className="form-check form-switch mb-2">
            <input className="form-check-input" type="checkbox" role="switch" id={`hereda-${rol}`} checked={!boton.color}
              onChange={(ev) => set({ color: ev.target.checked ? '' : colorRol })} />
            <label className="form-check-label small" htmlFor={`hereda-${rol}`}>
              Heredar el {r.colorNombre} <span className="muestra-mini" style={{ background: colorRol }}></span>
            </label>
          </div>
          {boton.color && <CampoColor id={`color-${rol}`} etiqueta="Color del botón" valor={c} onCambio={(v) => set({ color: v })} />}
        </div>
        <div className="col-sm-6">
          <div className="form-check form-switch mb-2">
            <input className="form-check-input" type="checkbox" role="switch" id={`texto-auto-${rol}`} checked={!boton.colorTexto}
              onChange={(ev) => set({ colorTexto: ev.target.checked ? '' : e['--bs-btn-color'] })} />
            <label className="form-check-label small" htmlFor={`texto-auto-${rol}`}>Color de texto automático</label>
          </div>
          {boton.colorTexto && <CampoColor id={`texto-${rol}`} etiqueta="Color del texto" valor={boton.colorTexto} onCambio={(v) => set({ colorTexto: v })} />}
        </div>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-sm-7">
          <span className="form-label small d-block mb-1" id={`forma-${rol}`}>Forma</span>
          <div className="btn-group btn-group-sm flex-wrap" role="group" aria-labelledby={`forma-${rol}`}>
            {FORMAS_BOTON.map((f) => (
              <Fragment key={f.id}>
                <input type="radio" className="btn-check" name={`forma-${rol}`} id={`forma-${rol}-${f.id}`} checked={boton.forma === f.id}
                  onChange={() => set({ forma: f.id })} />
                <label className="btn btn-outline-secondary" htmlFor={`forma-${rol}-${f.id}`}>{f.nombre}</label>
              </Fragment>
            ))}
          </div>
        </div>
        <div className="col-sm-5">
          <label className="form-label small mb-1" htmlFor={`peso-${rol}`}>Grosor del texto</label>
          <select id={`peso-${rol}`} className="form-select form-select-sm" value={boton.peso} onChange={(ev) => set({ peso: ev.target.value })}>
            {PESOS_BOTON.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
      </div>

      <div className="d-flex flex-wrap align-items-center gap-3">
        <div className="form-check form-switch mb-0">
          <input className="form-check-input" type="checkbox" role="switch" id={`mayus-${rol}`} checked={boton.mayusculas}
            onChange={(ev) => set({ mayusculas: ev.target.checked })} />
          <label className="form-check-label small" htmlFor={`mayus-${rol}`}>Texto en mayúsculas</label>
        </div>
        <span className="small ms-auto">
          Contraste del texto: <strong>{fmt(ratio)}</strong>{' '}
          <span className={`badge ${ratio >= 4.5 ? 'estado-abierta' : 'estado-cerrada'} badge-estado`}>{nivelWcag(ratio)}</span>
        </span>
      </div>
      {ratio < 4.5 && (
        <p className="small text-danger mt-2 mb-0" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-1" aria-hidden="true"></i>
          El texto no alcanza el contraste AA (4,5:1). Cambia el color del texto o del botón.
        </p>
      )}
    </div>
  );
}

export default function Marca() {
  const { configuracion, guardarConfiguracion } = useApp();
  // null = sin cambios (sigue a lo guardado); objeto = borrador que se previsualiza en todo el sitio
  const [borrador, setBorrador] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const guardada = normalizarMarca(configuracion?.marca);
  const marca = borrador || guardada;
  const sucio = borrador !== null && JSON.stringify(compactarMarca(borrador)) !== JSON.stringify(compactarMarca(guardada));
  const esBase = JSON.stringify(compactarMarca(marca)) === JSON.stringify({ colores: {}, botones: {} });

  const cambiarColor = (token, hex) => setBorrador({ ...marca, colores: { ...marca.colores, [token]: hex } });
  const cambiarBoton = (rol, b) => setBorrador({ ...marca, botones: { ...marca.botones, [rol]: b } });
  const cambiarAlertas = (cambios) => setBorrador({ ...marca, alertas: { ...marca.alertas, ...cambios } });

  const guardar = async () => {
    setProcesando(true);
    const r = await guardarConfiguracion({ ...configuracion, marca: compactarMarca(marca) }, 'Actualizó la identidad visual (colores y botones)');
    setProcesando(false);
    if (r.ok) setBorrador(null);
    setMensaje(r.ok ? { tipo: 'success', texto: 'Identidad visual guardada: ya se ve en todo el sitio.' } : { tipo: 'danger', texto: r.error });
  };

  // Muestras de cada estilo con el color del rol (para el selector de estilos)
  const cssMuestras = Object.entries(ROLES_BOTON)
    .flatMap(([rol, r]) => ESTILOS_BOTON.map((s) => cssBoton([`.btn-muestra-${rol}-${s.id}`], { ...marca.botones[rol], estilo: s.id }, marca.colores[r.token])))
    .join('') +
    ESTILOS_ALERTA.map((s) => cssAlertas({ ...marca.alertas, estilo: s.id }, marca.colores, `.alerta-muestra-${s.id} `)).join('');

  return (
    <div className="container py-4 py-md-5">
      {/* El borrador se aplica a toda la página mientras se edita; al salir sin guardar vuelve lo guardado */}
      {borrador && <style>{cssMarca(compactarMarca(borrador))}</style>}
      <style>{cssMuestras}</style>

      <PageHeader
        titulo="Guía de identidad visual"
        subtitulo="Paleta, tipografía y componentes del sitio. Los cambios de colores y botones se aplican a todas las páginas."
        migas={[{ label: 'Inicio', to: '/' }, { label: 'Guía de identidad visual' }]}
      />

      <div className="barra-marca card-flv p-2 px-3 mb-4 d-flex flex-wrap align-items-center gap-2" role="region" aria-label="Guardar identidad visual">
        <span className="small me-auto" role="status">
          {sucio ? (
            <><i className="bi bi-circle-fill text-rojo me-1" style={{ fontSize: '.55rem' }} aria-hidden="true"></i>Cambios sin guardar: estás viendo una vista previa.</>
          ) : (
            <><i className="bi bi-check-circle me-1" aria-hidden="true"></i>{esBase ? 'Usando la marca base del Festival.' : 'Identidad visual personalizada guardada.'}</>
          )}
        </span>
        <button type="button" className="btn btn-sm btn-outline-secondary" disabled={esBase || procesando}
          onClick={() => setBorrador(normalizarMarca({}))}>
          <i className="bi bi-arrow-counterclockwise me-1" aria-hidden="true"></i>Marca base
        </button>
        <button type="button" className="btn btn-sm btn-outline-secondary" disabled={!sucio || procesando} onClick={() => setBorrador(null)}>Descartar</button>
        <button type="button" className="btn btn-sm btn-primary" disabled={!sucio || procesando} onClick={guardar}>
          {procesando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
      {mensaje && (
        <div className={`alert alert-${mensaje.tipo} alert-dismissible`} role="status">
          {mensaje.texto}
          <button type="button" className="btn-close" aria-label="Cerrar mensaje" onClick={() => setMensaje(null)}></button>
        </div>
      )}

      <div className="alert aviso-crema small" role="note">
        <i className="bi bi-info-circle-fill me-1" aria-hidden="true"></i>
        La marca base se tomó de <strong>festivalvallenato.com</strong> (CSS computado e imagen del hero, revisado el
        2 oct 2026). Este prototipo académico <strong>no usa el logo oficial</strong> ni fotografías del Festival. Los colores
        «funcionales» son derivados para garantizar accesibilidad (WCAG 2.1 AA). Revisa el contraste al cambiar un color.
      </div>

      <section className="mb-5" aria-labelledby="t-roles">
        <h2 id="t-roles" className="seccion-titulo mb-4">Colores de acción</h2>
        <div className="row g-3">
          {[[TOKEN_PRIMARIO, 'Color primario', 'Botón primario, enlaces, navegación activa y acentos.'],
            [TOKEN_SECUNDARIO, 'Color secundario', 'Botón secundario y final del degradado del hero.']].map(([token, titulo, uso]) => (
            <div className="col-md-6" key={token}>
              <div className="card-flv p-3 d-flex align-items-center gap-3 h-100">
                <span className="muestra-rol" style={{ background: marca.colores[token] }} aria-hidden="true"></span>
                <div className="flex-grow-1">
                  <h3 className="h6 mb-0">{titulo}</h3>
                  <p className="small text-secondary-flv mb-2">{NOMBRES[token]} · <code>{token}</code> · {uso}</p>
                  <CampoColor id={`rol${token}`} etiqueta={titulo} valor={marca.colores[token]} onCambio={(v) => cambiarColor(token, v)} ocultarEtiqueta />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-5" aria-labelledby="t-botones">
        <h2 id="t-botones" className="seccion-titulo mb-2">Botones</h2>
        <p className="text-secondary-flv mb-4">
          El primario hereda el color primario y el secundario el color secundario; desactiva «Heredar» para darle otro color.
        </p>
        <div className="row g-3 mb-3">
          {Object.keys(ROLES_BOTON).map((rol) => (
            <div className="col-xl-6" key={rol}>
              <EditorBoton rol={rol} boton={marca.botones[rol]} colores={marca.colores} onCambio={(b) => cambiarBoton(rol, b)} />
            </div>
          ))}
        </div>
        <div className="row g-3">
          <div className="col-lg-7">
            <div className="card-flv p-4 h-100">
              <h3 className="h6 mb-3">Vista previa sobre fondo claro</h3>
              <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                <button type="button" className="btn btn-primary btn-lg">Votar ahora</button>
                <button type="button" className="btn btn-outline-primary btn-lg">Ver resultados</button>
              </div>
              <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                <button type="button" className="btn btn-primary">Primario</button>
                <button type="button" className="btn btn-outline-primary">Secundario</button>
                <button type="button" className="btn btn-primary btn-sm">Pequeño</button>
                <button type="button" className="btn btn-outline-primary btn-sm">Pequeño</button>
                <button type="button" className="btn btn-primary" disabled>Deshabilitado</button>
                <button type="button" className="btn btn-outline-primary" disabled>Deshabilitado</button>
              </div>
              <h3 className="h6 mb-2">Otros botones de la marca</h3>
              <div className="d-flex flex-wrap gap-2 mb-3">
                <button type="button" className="btn btn-negro">Negro</button>
                <button type="button" className="btn btn-dorado">Dorado</button>
                <button type="button" className="btn btn-peligro">Peligro</button>
              </div>
              <h3 className="h6 mb-2">Enlaces</h3>
              <p className="mb-0">
                <a href="/panel/marca" onClick={(e) => e.preventDefault()}>Enlace de texto</a> ·{' '}
                <a href="/panel/marca" className="enlace-mas" onClick={(e) => e.preventDefault()}>Leer más <i className="bi bi-arrow-right" aria-hidden="true"></i></a>
              </p>
            </div>
          </div>
          <div className="col-lg-5">
            <div className="muestra-oscura p-4 h-100">
              <h3 className="h6 mb-3" style={{ color: 'var(--flv-dorado)' }}>Vista previa sobre el hero</h3>
              <div className="d-flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary btn-lg">Votar ahora</button>
                <button type="button" className="btn btn-outline-primary btn-lg">Categorías</button>
              </div>
              <p className="small mt-3 mb-0" style={{ color: 'var(--flv-dorado-claro)' }}>
                Los estilos «Contorno», «Suave» y «Solo texto» calculan su texto para fondos claros; sobre el hero
                conviene un estilo sólido.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-5" aria-labelledby="t-alertas">
        <h2 id="t-alertas" className="seccion-titulo mb-2">Mensajes de alerta</h2>
        <p className="text-secondary-flv mb-4">
          Avisos, confirmaciones y errores de todo el sitio. Cada tipo toma su color de la paleta (ocre, verde abierta,
          dorado texto y rojo oscuro); el texto se ajusta solo para cumplir el contraste AA.
        </p>
        <div className="row g-3">
          <div className="col-xl-7">
            <fieldset className="card-flv p-3 p-md-4 h-100">
              <legend className="form-label fw-semibold fs-6 float-none">Estilo</legend>
              <div className="row g-2 mb-3">
                {ESTILOS_ALERTA.map((s) => (
                  <div className="col-sm-6 col-lg-4" key={s.id}>
                    <input type="radio" className="btn-check" name="estilo-alerta" id={`estilo-alerta-${s.id}`} checked={marca.alertas.estilo === s.id}
                      onChange={() => cambiarAlertas({ estilo: s.id })} />
                    <label className={`opcion-estilo alerta-muestra-${s.id}`} htmlFor={`estilo-alerta-${s.id}`}>
                      <span className="alert alert-success small py-1 px-2 mb-0 w-100 text-start" aria-hidden="true">
                        <i className="bi bi-check-circle-fill me-1"></i>Voto registrado
                      </span>
                      <span className="fw-semibold small">{s.nombre}</span>
                      <span className="opcion-config-desc small">{s.desc}</span>
                    </label>
                  </div>
                ))}
              </div>
              <span className="form-label small d-block mb-1" id="forma-alerta">Esquinas</span>
              <div className="btn-group btn-group-sm flex-wrap" role="group" aria-labelledby="forma-alerta">
                {FORMAS_BOTON.filter((f) => f.id !== 'pildora').map((f) => (
                  <Fragment key={f.id}>
                    <input type="radio" className="btn-check" name="forma-alerta" id={`forma-alerta-${f.id}`} checked={marca.alertas.forma === f.id}
                      disabled={marca.alertas.estilo === 'minimo'} onChange={() => cambiarAlertas({ forma: f.id })} />
                    <label className="btn btn-outline-secondary" htmlFor={`forma-alerta-${f.id}`}>{f.nombre}</label>
                  </Fragment>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="col-xl-5">
            <div className="card-flv p-3 p-md-4 h-100">
              <h3 className="h6 mb-3">Vista previa</h3>
              <div className="alert alert-info small py-2 mb-2" role="note">
                <i className="bi bi-info-circle-fill me-1" aria-hidden="true"></i>
                Las votaciones de la edición 2027 abren el <strong>26 de abril</strong>.
              </div>
              <div className="alert alert-success small py-2 mb-2 alert-dismissible" role="note">
                <i className="bi bi-check-circle-fill me-1" aria-hidden="true"></i>
                ¡Listo! Tu voto quedó registrado. <a href="/panel/marca" className="alert-link" onClick={(e) => e.preventDefault()}>Ver comprobante</a>
                <button type="button" className="btn-close" aria-label="Cerrar mensaje de ejemplo"></button>
              </div>
              <div className="alert alert-warning small py-2 mb-2" role="note">
                <i className="bi bi-exclamation-triangle-fill me-1" aria-hidden="true"></i>
                Esta votación cierra en 2 horas: aún puedes participar.
              </div>
              <div className="alert alert-danger small py-2 mb-0" role="note">
                <i className="bi bi-x-octagon-fill me-1" aria-hidden="true"></i>
                No pudimos registrar tu voto. Revisa tu conexión e inténtalo de nuevo.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-5" aria-labelledby="t-colores">
        <h2 id="t-colores" className="seccion-titulo mb-4">Paleta completa</h2>
        {GRUPOS_COLOR.map((g) => (
          <div key={g.grupo} className="mb-4">
            <h3 className="h5 mb-3">{g.grupo}</h3>
            <div className="row g-3">
              {g.colores.map((c) => (
                <div className="col-sm-6 col-lg-4 col-xl-3" key={c.token}>
                  <Swatch c={c} hex={marca.colores[c.token]} onCambio={(v) => cambiarColor(c.token, v)} />
                </div>
              ))}
            </div>
          </div>
        ))}
        <h3 className="h5 mb-3">Degradado del hero</h3>
        <div className="muestra-oscura p-4">
          <p className="mb-0 fw-semibold" style={{ color: 'var(--flv-dorado)' }}>
            linear-gradient(135deg, {marca.colores['--flv-negro']} 0%, {mezclar(marca.colores['--flv-negro'], marca.colores['--flv-ocre'], 0.34)} 55%, {marca.colores['--flv-ocre']} 100%)
          </p>
        </div>
      </section>

      <section className="mb-5" aria-labelledby="t-tipo">
        <h2 id="t-tipo" className="seccion-titulo mb-4">Tipografía</h2>
        <div className="row g-3">
          <div className="col-lg-6">
            <div className="card-flv p-4 h-100 especimen">
              <p className="small text-secondary-flv mb-1">Títulos · Raleway 800 (también 700)</p>
              <p className="mb-1" style={{ fontFamily: 'Raleway', fontWeight: 800, fontSize: '2.2rem', color: 'var(--flv-negro)', lineHeight: 1.1 }}>Festival de la Leyenda Vallenata</p>
              <p className="mb-0" style={{ fontFamily: 'Raleway', fontWeight: 700, fontSize: '1.4rem', color: 'var(--flv-negro)' }}>Raleway 700 · Aa Bb Cc Ññ 0123456789</p>
            </div>
          </div>
          <div className="col-lg-6">
            <div className="card-flv p-4 h-100 especimen">
              <p className="small text-secondary-flv mb-1">Texto, navegación y botones · Poppins</p>
              <p className="mb-1" style={{ fontWeight: 400 }}>Poppins 400 — El acordeón, la caja y la guacharaca suenan en la plaza.</p>
              <p className="mb-1" style={{ fontWeight: 600, color: 'var(--flv-negro)' }}>Poppins 600 — Navegación y etiquetas</p>
              <p className="mb-0" style={{ fontWeight: 700, color: 'var(--flv-negro)' }}>Poppins 700 — Botones y cifras destacadas</p>
            </div>
          </div>
          <div className="col-12">
            <div className="muestra-oscura p-4">
              <p className="mb-1" style={{ fontFamily: 'Raleway', fontWeight: 800, fontSize: '2rem', color: 'var(--flv-dorado)', lineHeight: 1.1 }}>Título dorado sobre fondo oscuro</p>
              <p className="mb-0" style={{ color: '#fff' }}>El dorado solo se usa para títulos sobre negro, carbón u ocre. Sobre blanco se usa negro o el dorado texto.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-4" aria-labelledby="t-comp">
        <h2 id="t-comp" className="seccion-titulo mb-4">Otros componentes</h2>
        <div className="row g-3">
          <div className="col-12">
            <div className="card-flv p-4 h-100">
              <h3 className="h6 mb-3">Insignias de estado</h3>
              <div className="d-flex flex-wrap gap-2">
                <EstadoBadge estado="abierta" />
                <EstadoBadge estado="programada" />
                <EstadoBadge estado="cerrada" />
                <span className="badge badge-dorado"><i className="bi bi-trophy-fill me-1" aria-hidden="true"></i>Ganadora</span>
                <span className="badge badge-ilustrativo">Ilustrativo</span>
              </div>
            </div>
          </div>
          <div className="col-12">
            <div className="banda-negra rounded-3 p-4">
              <p className="etiqueta mb-2">Banda negra / cuenta regresiva</p>
              <div className="d-flex gap-4">
                {[['208', 'días'], ['14', 'horas'], ['32', 'min']].map(([v, l]) => (
                  <div key={l} className="text-center">
                    <span className="valor d-block">{v}</span>
                    <span className="etiqueta">{l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="t-reglas" className="card-flv p-4">
        <h2 id="t-reglas" className="h5">Reglas de uso (marca base)</h2>
        <ul className="mb-0">
          <li>El color primario es el color de acción: un solo botón primario por bloque; el secundario acompaña.</li>
          <li>Texto blanco sobre rojo #DD3333 (4,57:1) cumple AA; para enlaces sobre #F8F8F8 se usa #B71C1C.</li>
          <li>Dorado solo sobre fondos oscuros; sobre blanco usar negro o #8A6A2E.</li>
          <li>Navbar, hero y pie de página en negro; secciones de contenido en blanco o #F8F8F8 con texto #555555.</li>
          <li>Títulos en Raleway 800 negro; texto, navegación y botones en Poppins.</li>
          <li>No usar el logo oficial, fotografías ni imágenes de artistas del Festival en el prototipo.</li>
        </ul>
      </section>
    </div>
  );
}
