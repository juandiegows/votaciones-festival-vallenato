import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import EstadoBadge from '../components/EstadoBadge.jsx';
import Countdown from '../components/Countdown.jsx';
import Avatar from '../components/Avatar.jsx';
import Modal from '../components/Modal.jsx';
import ResultadosChart from '../components/ResultadosChart.jsx';
import NoEncontrado from './NoEncontrado.jsx';
import { formatearFechaHora, resultadosVisibles } from '../utils/helpers.js';

const claveSeleccion = (id) => `flv27_seleccion_${id}`;

function leerSeleccion(id) {
  try {
    return Number(sessionStorage.getItem(claveSeleccion(id))) || null;
  } catch {
    return null;
  }
}

export default function VotacionDetalle() {
  const { id } = useParams();
  const votacionId = Number(id);
  const { votaciones, categorias, opciones, votos, usuario, esAdmin, votosDeUsuario, emitirVoto } = useApp();
  const [seleccion, setSeleccion] = useState(() => leerSeleccion(votacionId));
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const votacion = votaciones.find((v) => v.id === votacionId);
  if (!votacion || (!votacion.publicada && !esAdmin)) return <NoEncontrado mensaje="La votación no existe o aún no ha sido publicada." />;

  const categoria = categorias.find((c) => c.id === votacion.categoriaId);
  const lista = opciones.filter((o) => o.votacionId === votacion.id).sort((a, b) => a.orden - b.orden);
  const misVotos = votosDeUsuario(votacion.id);
  const yaVoto = misVotos.length >= votacion.votosPorUsuario;
  const abierta = votacion.estado === 'abierta';
  const puedeVotar = abierta && !yaVoto;
  const opcionElegida = lista.find((o) => o.id === (yaVoto ? misVotos[0].opcionId : seleccion));

  const elegir = (opcionId) => {
    setSeleccion(opcionId);
    setError('');
    try {
      sessionStorage.setItem(claveSeleccion(votacion.id), String(opcionId));
    } catch {
      /* ignorar */
    }
  };

  const votar = () => {
    if (!seleccion) {
      setError('Selecciona una opción antes de votar.');
      document.getElementById('lista-opciones')?.focus();
      return;
    }
    // RN-02: solo usuarios autenticados; se redirige al login y luego se regresa aquí
    if (!usuario) {
      navigate('/login', { state: { desde: `/votaciones/${votacion.id}`, aviso: 'Inicia sesión o regístrate para registrar tu voto. Guardamos tu selección.' } });
      return;
    }
    setConfirmando(true);
  };

  const confirmar = () => {
    const r = emitirVoto(votacion.id, seleccion);
    setConfirmando(false);
    if (!r.ok) return setError(r.error);
    try {
      sessionStorage.removeItem(claveSeleccion(votacion.id));
    } catch {
      /* ignorar */
    }
    navigate(`/votaciones/${votacion.id}/comprobante`);
  };

  let mensajeEstado = null;
  if (votacion.estado === 'programada') mensajeEstado = `Esta votación aún no está abierta. Podrás votar a partir del ${formatearFechaHora(votacion.fechaApertura)} (RN-03).`;
  if (votacion.estado === 'cerrada') mensajeEstado = `Esta votación cerró el ${formatearFechaHora(votacion.fechaCierre)}. Ya no se reciben votos (RN-03).`;

  return (
    <div className="container py-4 py-md-5">
      <PageHeader
        titulo={votacion.titulo}
        subtitulo={`Detalle de la votación (RF-06) · Categoría ${categoria?.nombre}`}
        migas={[
          { label: 'Inicio', to: '/' },
          { label: 'Categorías', to: '/categorias' },
          { label: categoria?.nombre, to: `/categorias/${categoria?.id}` },
          { label: votacion.titulo },
        ]}
      />
      {!votacion.publicada && <div className="alert alert-secondary">Vista previa de administrador: esta votación no está publicada.</div>}

      <div className="row g-4">
        <div className="col-lg-4 order-lg-2">
          <aside className="card-flv p-4 mb-3" aria-label="Información de la votación">
            <div className="mb-3"><EstadoBadge estado={votacion.estado} /></div>
            <p>{votacion.descripcion}</p>
            <dl className="small mb-3">
              <dt>Apertura</dt>
              <dd>{formatearFechaHora(votacion.fechaApertura)}</dd>
              <dt>Cierre</dt>
              <dd>{formatearFechaHora(votacion.fechaCierre)}</dd>
              <dt>Votos por usuario</dt>
              <dd>{votacion.votosPorUsuario} <span className="text-secondary-flv">(pendiente de validación)</span></dd>
              <dt>Resultados</dt>
              <dd className="mb-0">{votacion.mostrarResultados}</dd>
            </dl>
            {abierta && <Countdown hasta={votacion.fechaCierre} etiqueta="Cierra en" />}
            {votacion.estado === 'programada' && <Countdown hasta={votacion.fechaApertura} etiqueta="Abre en" />}
          </aside>
          <section className="card-flv p-4" aria-labelledby="titulo-reglas">
            <h2 id="titulo-reglas" className="h6"><i className="bi bi-journal-check me-1" aria-hidden="true"></i>Reglas de la votación</h2>
            <ul className="small mb-0 ps-3">
              <li>Debes iniciar sesión para votar (RN-02).</li>
              <li>Solo se vota entre la fecha de apertura y la de cierre (RN-03).</li>
              <li>Un voto por persona en esta votación (RN-04).</li>
              <li>Una vez confirmado, el voto no se puede cambiar (RN-05).</li>
              <li>Los resultados se publican según la configuración: «{votacion.mostrarResultados}» (RN-07).</li>
            </ul>
          </section>
        </div>

        <div className="col-lg-8 order-lg-1">
          {yaVoto && (
            <div className="alert alert-success d-flex flex-wrap align-items-center gap-2" role="status">
              <i className="bi bi-check-circle-fill fs-4" aria-hidden="true"></i>
              <div className="flex-grow-1">
                <strong>Ya votaste en esta votación.</strong> Tu voto fue registrado y no se puede modificar (RN-04, RN-05).
              </div>
              <Link to={`/votaciones/${votacion.id}/comprobante`} className="btn btn-sm btn-success">Ver comprobante</Link>
            </div>
          )}
          {mensajeEstado && (
            <div className={`alert ${votacion.estado === 'cerrada' ? 'alert-danger' : 'alert-warning'}`} role="status">
              <i className={`bi ${votacion.estado === 'cerrada' ? 'bi-lock-fill' : 'bi-clock'} me-1`} aria-hidden="true"></i>
              {mensajeEstado}
            </div>
          )}

          <fieldset id="lista-opciones" tabIndex={-1} aria-describedby={error ? 'error-voto' : undefined}>
            <legend className="h5 mb-3">Opciones disponibles <span className="text-secondary-flv fs-6 fw-normal">({lista.length})</span></legend>
            <div className="row g-3">
              {lista.map((o) => {
                const marcada = yaVoto ? misVotos[0].opcionId === o.id : seleccion === o.id;
                return (
                  <div className="col-md-6" key={o.id}>
                    <input
                      type="radio"
                      className="opcion-input"
                      name="opcion"
                      id={`opcion-${o.id}`}
                      value={o.id}
                      checked={marcada}
                      disabled={!puedeVotar}
                      onChange={() => elegir(o.id)}
                    />
                    <label htmlFor={`opcion-${o.id}`} className="opcion-card">
                      <Avatar nombre={o.nombre} />
                      <span>
                        <span className="d-block fw-semibold">{o.nombre}</span>
                        <span className="d-block small text-secondary-flv">{o.descripcion}</span>
                        {o.enlaceMultimedia && (
                          <span className="d-block small mt-1 text-rojo-oscuro">
                            <i className="bi bi-play-circle me-1" aria-hidden="true"></i>Muestra multimedia (simulada)
                          </span>
                        )}
                      </span>
                      <span className="opcion-check" aria-hidden="true">{marcada && <i className="bi bi-check-lg"></i>}</span>
                    </label>
                  </div>
                );
              })}
            </div>
          </fieldset>

          {error && <div id="error-voto" className="alert alert-danger mt-3" role="alert">{error}</div>}

          {!yaVoto && (
            <div className="d-flex flex-column flex-sm-row align-items-sm-center gap-2 mt-4">
              <button type="button" className="btn btn-primary btn-lg px-5" disabled={!abierta} onClick={votar}>
                <i className="bi bi-check2-square me-2" aria-hidden="true"></i>Votar
              </button>
              {!usuario && abierta && <span className="small text-secondary-flv">Te pediremos iniciar sesión antes de confirmar.</span>}
              {!abierta && <span className="small text-secondary-flv">El botón se habilita solo con la votación abierta.</span>}
            </div>
          )}

          <section className="card-flv p-4 mt-4" aria-labelledby="titulo-resultados">
            <h2 id="titulo-resultados" className="h5"><i className="bi bi-bar-chart-fill me-1" aria-hidden="true"></i>Resultados</h2>
            {resultadosVisibles(votacion) ? (
              <ResultadosChart opciones={lista} votos={votos.filter((v) => v.votacionId === votacion.id)} cerrada={votacion.estado === 'cerrada'} />
            ) : (
              <p className="mb-0 text-secondary-flv">
                {votacion.mostrarResultados === 'no publicar'
                  ? 'Los resultados de esta votación no se publican al público (RN-07).'
                  : 'Los resultados se publicarán al cierre de la votación (RN-07).'}
              </p>
            )}
          </section>
        </div>
      </div>

      <Modal
        abierto={confirmando}
        titulo="Confirma tu voto"
        onCerrar={() => setConfirmando(false)}
        pie={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setConfirmando(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={confirmar}>
              <i className="bi bi-check-circle me-1" aria-hidden="true"></i>Confirmar voto
            </button>
          </>
        }
      >
        <p className="mb-2">Estás a punto de votar en <strong>{votacion.titulo}</strong> por:</p>
        {opcionElegida && (
          <div className="d-flex align-items-center gap-3 p-3 rounded-3 mb-3" style={{ background: 'var(--flv-crema)' }}>
            <Avatar nombre={opcionElegida.nombre} />
            <div>
              <p className="fw-semibold mb-0">{opcionElegida.nombre}</p>
              <p className="small mb-0 text-secondary-flv">{opcionElegida.descripcion}</p>
            </div>
          </div>
        )}
        <div className="alert alert-warning mb-0 small" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-1" aria-hidden="true"></i>
          <strong>Importante:</strong> una vez confirmado, no podrás cambiar tu voto (RN-05).
        </div>
      </Modal>
    </div>
  );
}
