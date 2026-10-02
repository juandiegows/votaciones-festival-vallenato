import { Link, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Avatar from '../components/Avatar.jsx';
import ResultadosChart from '../components/ResultadosChart.jsx';
import NoEncontrado from './NoEncontrado.jsx';
import { formatearFechaHora, resultadosVisibles } from '../utils/helpers.js';

export default function Comprobante() {
  const { id } = useParams();
  const { votaciones, opciones, votos, usuario, votosDeUsuario } = useApp();
  const votacion = votaciones.find((v) => v.id === Number(id));
  if (!votacion) return <NoEncontrado />;
  const voto = votosDeUsuario(votacion.id)[0];

  if (!voto) {
    return (
      <div className="container py-5 text-center">
        <h1 className="h3">Aún no has votado en «{votacion.titulo}»</h1>
        <Link to={`/votaciones/${votacion.id}`} className="btn btn-primary mt-2">Ir a la votación</Link>
      </div>
    );
  }

  const opcion = opciones.find((o) => o.id === voto.opcionId);
  const lista = opciones.filter((o) => o.votacionId === votacion.id);

  return (
    <div className="container py-4 py-md-5">
      <PageHeader
        titulo="Comprobante de voto"
        subtitulo="Mensaje posterior a la votación (RF-09)"
        migas={[{ label: 'Inicio', to: '/' }, { label: votacion.titulo, to: `/votaciones/${votacion.id}` }, { label: 'Comprobante' }]}
      />
      <div className="row g-4">
        <div className="col-lg-6">
          <section className="comprobante p-4 text-center" aria-labelledby="titulo-exito">
            <i className="bi bi-patch-check-fill display-4 text-success" aria-hidden="true"></i>
            <h2 id="titulo-exito" className="h4 mt-2">¡Tu voto fue registrado con éxito!</h2>
            <p className="mb-3">Gracias por participar, {usuario.nombres}. Guarda este código como constancia.</p>
            <p className="small text-secondary-flv mb-1">Código de comprobante</p>
            <p className="codigo-comprobante fw-bold mb-3" aria-label={`Código de comprobante ${voto.codigoComprobante.split('').join(' ')}`}>
              {voto.codigoComprobante}
            </p>
            <dl className="row small text-start mx-0 mb-3">
              <dt className="col-5">Votación</dt>
              <dd className="col-7">{votacion.titulo}</dd>
              <dt className="col-5">Fecha y hora</dt>
              <dd className="col-7">{formatearFechaHora(voto.fechaHora)}</dd>
              <dt className="col-5">Votante</dt>
              <dd className="col-7 text-break">{usuario.correo}</dd>
            </dl>
            <div className="d-flex align-items-center gap-3 p-3 rounded-3 text-start" style={{ background: 'var(--flv-crema)' }}>
              <Avatar nombre={opcion.nombre} tamano={48} />
              <div>
                <p className="small mb-0 text-secondary-flv">Tu elección</p>
                <p className="fw-semibold mb-0">{opcion.nombre}</p>
              </div>
            </div>
            <div className="d-flex flex-wrap justify-content-center gap-2 mt-4">
              <button type="button" className="btn btn-outline-primary" onClick={() => window.print()}>
                <i className="bi bi-printer me-1" aria-hidden="true"></i>Imprimir
              </button>
              <Link to="/mis-votos" className="btn btn-outline-primary"><i className="bi bi-receipt me-1" aria-hidden="true"></i>Mis votos</Link>
              <Link to="/categorias" className="btn btn-primary">Seguir votando</Link>
            </div>
          </section>
        </div>
        <div className="col-lg-6">
          <section className="card-flv p-4 h-100" aria-labelledby="titulo-res">
            <h2 id="titulo-res" className="h5"><i className="bi bi-bar-chart-fill me-1" aria-hidden="true"></i>Resultados</h2>
            {resultadosVisibles(votacion) ? (
              <>
                <p className="small text-secondary-flv">Resultados en tiempo real (RN-07).</p>
                <ResultadosChart opciones={lista} votos={votos.filter((v) => v.votacionId === votacion.id)} cerrada={votacion.estado === 'cerrada'} />
              </>
            ) : (
              <div className="text-center py-4">
                <i className="bi bi-hourglass-split fs-1 text-dorado-texto" aria-hidden="true"></i>
                <p className="mt-2 mb-0">
                  {votacion.mostrarResultados === 'no publicar'
                    ? 'Los resultados de esta votación no se publicarán al público (RN-07).'
                    : 'Resultados se publicarán al cierre de la votación (RN-07).'}
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
