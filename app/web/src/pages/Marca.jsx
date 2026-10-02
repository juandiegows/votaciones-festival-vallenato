import PageHeader from '../components/PageHeader.jsx';
import EstadoBadge from '../components/EstadoBadge.jsx';
import { GRUPOS_COLOR, contraste, hexARgb, nivelWcag } from '../data/marca.js';

const fmt = (r) => `${r.toFixed(2).replace('.', ',')}:1`;

function Swatch({ c }) {
  const ratioPar = contraste(c.hex, c.par);
  const textoMuestra = contraste(c.hex, '#FFFFFF') >= contraste(c.hex, '#000000') ? '#FFFFFF' : '#000000';
  return (
    <article className="swatch">
      <div className="swatch-color" style={{ background: c.hex, color: textoMuestra, borderBottom: '1px solid #E9E9E9' }}>
        {c.hex}
      </div>
      <div className="p-3">
        <h4 className="h6 mb-1">{c.nombre}</h4>
        <p className="small mb-2"><code>{c.token}</code></p>
        <dl>
          <dt>HEX</dt>
          <dd>{c.hex}</dd>
          <dt>RGB</dt>
          <dd>rgb({hexARgb(c.hex).join(', ')})</dd>
          <dt>Uso</dt>
          <dd>{c.uso}</dd>
          <dt>Contraste</dt>
          <dd>
            Blanco {fmt(contraste(c.hex, '#FFFFFF'))} · Negro {fmt(contraste(c.hex, '#000000'))}
          </dd>
          <dt>Par recomendado</dt>
          <dd className="mb-0 d-flex flex-wrap align-items-center gap-2">
            <span className="px-2 py-1 rounded fw-semibold" style={{ background: c.hex, color: c.par, border: '1px solid #ccc' }}>Aa {c.par}</span>
            <strong>{fmt(ratioPar)}</strong>
            <span className={`badge ${ratioPar >= 4.5 ? 'estado-abierta' : 'estado-cerrada'} badge-estado`}>{nivelWcag(ratioPar)}</span>
          </dd>
        </dl>
      </div>
    </article>
  );
}

export default function Marca() {
  return (
    <div className="container py-4 py-md-5">
      <PageHeader
        titulo="Guía de identidad visual"
        subtitulo="Paleta, tipografía y componentes del prototipo, alineados con la marca del Festival de la Leyenda Vallenata."
        migas={[{ label: 'Inicio', to: '/' }, { label: 'Guía de identidad visual' }]}
      />

      <div className="alert aviso-crema small" role="note">
        <i className="bi bi-info-circle-fill me-1" aria-hidden="true"></i>
        Los colores se tomaron de <strong>festivalvallenato.com</strong> (CSS computado e imagen del hero, revisado el
        2 oct 2026). Este prototipo académico <strong>no usa el logo oficial</strong> ni fotografías del Festival: usa una
        marca gráfica propia y simple. Los colores «funcionales» son derivados para garantizar accesibilidad (WCAG 2.1
        AA) y no son colores del cliente.
      </div>

      <section className="mb-5" aria-labelledby="t-colores">
        <h2 id="t-colores" className="seccion-titulo mb-4">Colores</h2>
        {GRUPOS_COLOR.map((g) => (
          <div key={g.grupo} className="mb-4">
            <h3 className="h5 mb-3">{g.grupo}</h3>
            <div className="row g-3">
              {g.colores.map((c) => (
                <div className="col-sm-6 col-lg-4 col-xl-3" key={c.token}>
                  <Swatch c={c} />
                </div>
              ))}
            </div>
          </div>
        ))}
        <h3 className="h5 mb-3">Degradado del hero</h3>
        <div className="muestra-oscura p-4">
          <p className="mb-0 fw-semibold" style={{ color: '#D7AC70' }}>linear-gradient(135deg, #000000 0%, #2A0B08 55%, #7D2710 100%)</p>
        </div>
      </section>

      <section className="mb-5" aria-labelledby="t-tipo">
        <h2 id="t-tipo" className="seccion-titulo mb-4">Tipografía</h2>
        <div className="row g-3">
          <div className="col-lg-6">
            <div className="card-flv p-4 h-100 especimen">
              <p className="small text-secondary-flv mb-1">Títulos · Raleway 800 (también 700)</p>
              <p className="mb-1" style={{ fontFamily: 'Raleway', fontWeight: 800, fontSize: '2.2rem', color: '#000', lineHeight: 1.1 }}>Festival de la Leyenda Vallenata</p>
              <p className="mb-0" style={{ fontFamily: 'Raleway', fontWeight: 700, fontSize: '1.4rem', color: '#000' }}>Raleway 700 · Aa Bb Cc Ññ 0123456789</p>
            </div>
          </div>
          <div className="col-lg-6">
            <div className="card-flv p-4 h-100 especimen">
              <p className="small text-secondary-flv mb-1">Texto, navegación y botones · Poppins</p>
              <p className="mb-1" style={{ fontWeight: 400 }}>Poppins 400 — El acordeón, la caja y la guacharaca suenan en la plaza.</p>
              <p className="mb-1" style={{ fontWeight: 600, color: '#000' }}>Poppins 600 — Navegación y etiquetas</p>
              <p className="mb-0" style={{ fontWeight: 700, color: '#000' }}>Poppins 700 — Botones y cifras destacadas</p>
            </div>
          </div>
          <div className="col-12">
            <div className="muestra-oscura p-4">
              <p className="mb-1" style={{ fontFamily: 'Raleway', fontWeight: 800, fontSize: '2rem', color: '#D7AC70', lineHeight: 1.1 }}>Título dorado sobre fondo oscuro</p>
              <p className="mb-0" style={{ color: '#fff' }}>El dorado (#D7AC70) solo se usa para títulos sobre negro, carbón u ocre. Sobre blanco se usa negro o #8A6A2E.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-4" aria-labelledby="t-comp">
        <h2 id="t-comp" className="seccion-titulo mb-4">Componentes</h2>
        <div className="row g-3">
          <div className="col-lg-6">
            <div className="card-flv p-4 h-100">
              <h3 className="h6 mb-3">Botones</h3>
              <div className="d-flex flex-wrap gap-2 mb-3">
                <button type="button" className="btn btn-primary">Primario</button>
                <button type="button" className="btn btn-outline-primary">Secundario</button>
                <button type="button" className="btn btn-negro">Negro</button>
                <button type="button" className="btn btn-dorado">Dorado</button>
                <button type="button" className="btn btn-peligro">Peligro</button>
                <button type="button" className="btn btn-primary" disabled>Deshabilitado</button>
              </div>
              <h3 className="h6 mb-2">Enlaces</h3>
              <p className="mb-0">
                <a href="/marca" onClick={(e) => e.preventDefault()}>Enlace de texto</a> ·{' '}
                <a href="/marca" className="enlace-mas" onClick={(e) => e.preventDefault()}>Leer más <i className="bi bi-arrow-right" aria-hidden="true"></i></a>
              </p>
            </div>
          </div>
          <div className="col-lg-6">
            <div className="card-flv p-4 h-100">
              <h3 className="h6 mb-3">Insignias de estado</h3>
              <div className="d-flex flex-wrap gap-2 mb-3">
                <EstadoBadge estado="abierta" />
                <EstadoBadge estado="programada" />
                <EstadoBadge estado="cerrada" />
                <span className="badge badge-dorado"><i className="bi bi-trophy-fill me-1" aria-hidden="true"></i>Ganadora</span>
                <span className="badge badge-ilustrativo">Ilustrativo</span>
              </div>
              <h3 className="h6 mb-2">Mensajes</h3>
              <div className="alert aviso-crema small py-2 mb-2">Aviso informativo sobre fondo crema.</div>
              <div className="alert alert-danger small py-2 mb-0">Error de validación (rojo oscuro #B71C1C).</div>
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
        <h2 id="t-reglas" className="h5">Reglas de uso</h2>
        <ul className="mb-0">
          <li>El rojo #DD3333 es el color de acción: un solo botón primario por bloque.</li>
          <li>Texto blanco sobre rojo (4,57:1) cumple AA; para enlaces sobre #F8F8F8 se usa #B71C1C.</li>
          <li>Dorado solo sobre fondos oscuros; sobre blanco usar negro o #8A6A2E.</li>
          <li>Navbar, hero y pie de página en negro; secciones de contenido en blanco o #F8F8F8 con texto #555555.</li>
          <li>Títulos en Raleway 800 negro; texto, navegación y botones en Poppins.</li>
          <li>No usar el logo oficial, fotografías ni imágenes de artistas del Festival en el prototipo.</li>
        </ul>
      </section>
    </div>
  );
}
