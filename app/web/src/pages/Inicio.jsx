import { Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import HeroAcordeon from '../components/HeroAcordeon.jsx';
import VotacionCard from '../components/VotacionCard.jsx';
import { formatearFecha } from '../utils/helpers.js';
import { votacionesPublicas } from '../utils/visibilidad.js';
import { useRutas } from '../hooks/useRutas.js';
import SinEdicion from '../components/SinEdicion.jsx';
import HeroBanners from '../components/HeroBanners.jsx';

// pdf.js y page-flip solo se descargan si hay una revista que mostrar
const RevistaLibro = lazy(() => import('../components/RevistaLibro.jsx'));

const PASOS = [
  { icono: 'person-plus', titulo: 'Regístrate', texto: 'Crea tu cuenta con tu correo y acepta la política de tratamiento de datos.' },
  { icono: 'grid-3x3-gap', titulo: 'Explora', texto: 'Revisa las categorías y las votaciones abiertas de la edición.' },
  { icono: 'hand-index-thumb', titulo: 'Elige y confirma', texto: 'Selecciona tu opción favorita y confirma tu voto. ¡Solo una vez!' },
  { icono: 'receipt', titulo: 'Recibe tu comprobante', texto: 'Obtén un código único que respalda tu participación.' },
];

export default function Inicio() {
  const datos = useApp();
  const { usuario, edicionActiva, opciones, categorias, totalVotos, votosDeUsuario, banners, configuracion, revistas = [] } = datos;
  // La primera revista activa de la lista definida en /panel/revista
  const revista = revistas.filter((r) => r.activa).sort((a, b) => a.orden - b.orden || b.id - a.id)[0];
  // Solo los banners de la edición activa (los que no tienen edición se consideran de la activa);
  // en modo «fijo» se muestra únicamente el primero
  const bannersEdicion = banners.filter((b) => b.activo && (b.edicionId ?? edicionActiva?.id) === edicionActiva?.id).sort((a, b) => a.orden - b.orden);
  const bannersActivos = configuracion?.modoBanner === 'fijo' ? bannersEdicion.slice(0, 1) : bannersEdicion;
  const rutas = useRutas();
  if (!edicionActiva) return <SinEdicion />;
  const publicas = votacionesPublicas(datos);
  const abiertas = publicas.filter((v) => v.estado === 'abierta');
  // Con sesión iniciada, «Votar» lleva a la categoría de la primera votación abierta pendiente
  const pendiente = abiertas.find((v) => votosDeUsuario(v.id).length === 0) || abiertas[0];
  const categoriaPendiente = pendiente && categorias.find((c) => c.id === pendiente.categoriaId);
  const diasFestival = Math.max(0, Math.ceil((new Date(`${edicionActiva.fechaInicio}T00:00:00`) - Date.now()) / 86400000));
  const cifras = [
    [diasFestival, 'días para el Festival'],
    [abiertas.length, 'votaciones abiertas'],
    [categorias.filter((c) => c.activa && c.edicionId === edicionActiva.id).length, 'categorías'],
    // El total de votos solo es público en el modo demostración; con la API se muestran las programadas
    totalVotos === null
      ? [publicas.filter((v) => v.estado === 'programada').length, 'votaciones programadas']
      : [totalVotos, 'votos registrados'],
  ];

  return (
    <>
      {bannersActivos.length > 0 ? (
        <HeroBanners banners={bannersActivos} titulo={edicionActiva.nombre} />
      ) : (
      <section className="hero py-5" aria-labelledby="titulo-hero">
        <div className="container py-lg-4">
          <div className="row align-items-center g-4">
            <div className="col-lg-7">
              <span className="badge hero-badge rounded-pill px-3 py-2 mb-3">
                <i className="bi bi-calendar-event me-1" aria-hidden="true"></i>
                Edición {edicionActiva.anio} · {formatearFecha(edicionActiva.fechaInicio)} – {formatearFecha(edicionActiva.fechaFin)}
              </span>
              <h1 id="titulo-hero">Tu voz también hace parte de la leyenda</h1>
              <p className="lead mb-4">
                Participa en las votaciones del público del <strong>{edicionActiva.nombre}</strong>. Elige tus canciones,
                comparsas y agrupaciones favoritas desde cualquier dispositivo.
              </p>
              <div className="d-flex flex-wrap gap-2 hero-acciones">
                <Link to={rutas.edicion(edicionActiva)} className="btn btn-primary btn-lg">
                  <i className="bi bi-check2-square me-2" aria-hidden="true"></i>Ver votaciones
                </Link>
                {usuario ? (
                  <Link to={categoriaPendiente ? rutas.categoria(categoriaPendiente) : rutas.edicion(edicionActiva)} className="btn btn-outline-light btn-lg">
                    <i className="bi bi-hand-index-thumb me-2" aria-hidden="true"></i>Votar
                  </Link>
                ) : (
                  <Link to="/registro" className="btn btn-outline-light btn-lg">Crear cuenta</Link>
                )}
              </div>
              <ul className="list-inline mt-4 mb-0 small">
                <li className="list-inline-item me-3"><i className="bi bi-unlock me-1" aria-hidden="true"></i>{abiertas.length} votaciones abiertas</li>
                <li className="list-inline-item me-3"><i className="bi bi-grid me-1" aria-hidden="true"></i>{categorias.filter((c) => c.activa && c.edicionId === edicionActiva.id).length} categorías</li>
                <li className="list-inline-item"><i className="bi bi-shield-check me-1" aria-hidden="true"></i>1 voto por persona</li>
              </ul>
            </div>
            <div className="col-lg-5 text-center">
              <HeroAcordeon />
            </div>
          </div>
        </div>
      </section>
      )}

      <section className="banda-negra py-4" aria-label="Cifras de la edición">
        <div className="container">
          <ul className="row g-3 list-unstyled mb-0 text-center">
            {cifras.map(([valor, etiqueta]) => (
              <li className="col-6 col-md-3" key={etiqueta}>
                <span className="valor d-block">{valor.toLocaleString('es-CO')}</span>
                <span className="etiqueta">{etiqueta}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {revista && (
        <section className="seccion-revista py-5" aria-labelledby="titulo-revista">
          <div className="container">
            <div className="text-center mb-4">
              <h2 id="titulo-revista" className="seccion-titulo seccion-titulo-centro">Revista institucional</h2>
              <p className="revista-titulo mb-1">{revista.titulo}</p>
              {revista.descripcion && <p className="revista-descripcion mb-0">{revista.descripcion}</p>}
              <p className="revista-ayuda small mt-2 mb-0">
                <i className="bi bi-hand-index me-1" aria-hidden="true"></i>Arrastra la esquina de la página o usa las flechas para hojearla.
              </p>
            </div>
            <Suspense fallback={<div className="revista-estado position-static" role="status">Cargando la revista…</div>}>
              <RevistaLibro key={revista.id} url={revista.archivo} titulo={revista.titulo} />
            </Suspense>
          </div>
        </section>
      )}

      <section className="container py-5" aria-labelledby="como-funciona">
        <h2 id="como-funciona" className="seccion-titulo mb-4">¿Cómo funciona?</h2>
        <ol className="row g-3 list-unstyled">
          {PASOS.map((p, i) => (
            <li className="col-sm-6 col-lg-3" key={p.titulo}>
              <div className="card-flv h-100 p-3">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <span className="paso-num" aria-hidden="true">{i + 1}</span>
                  <i className={`bi bi-${p.icono} fs-4 text-rojo`} aria-hidden="true"></i>
                </div>
                <h3 className="h5">
                  <span className="visually-hidden">Paso {i + 1}: </span>
                  {p.titulo}
                </h3>
                <p className="small mb-0">{p.texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="container pb-4" aria-labelledby="destacadas">
        <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-4">
          <h2 id="destacadas" className="seccion-titulo mb-0">Votaciones abiertas</h2>
          <Link to={rutas.edicion(edicionActiva)} className="enlace-mas">Ver todas las categorías <i className="bi bi-arrow-right" aria-hidden="true"></i></Link>
        </div>
        {abiertas.length === 0 ? (
          <p>No hay votaciones abiertas en este momento.</p>
        ) : (
          <div className="row g-3">
            {abiertas.map((v) => (
              <div className="col-md-6 col-lg-4" key={v.id}>
                <VotacionCard
                  votacion={v}
                  categoria={categorias.find((c) => c.id === v.categoriaId)}
                  numOpciones={opciones.filter((o) => o.votacionId === v.id).length}
                  yaVoto={votosDeUsuario(v.id).length > 0}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
