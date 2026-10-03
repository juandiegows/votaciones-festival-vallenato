import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { votacionesPublicas } from '../utils/visibilidad.js';
import { useRutaPublica, useRutas } from '../hooks/useRutas.js';
import NoEncontrado from './NoEncontrado.jsx';

export default function Categorias() {
  const datos = useApp();
  const { categorias, edicionActiva } = datos;
  const { edicion } = useRutaPublica();
  const rutas = useRutas();
  if (!edicion) return <NoEncontrado mensaje="No encontramos una edición del Festival con ese año." />;
  const publicas = votacionesPublicas(datos, edicion);
  const lista = categorias.filter((c) => c.activa && c.edicionId === edicion.id).sort((a, b) => a.orden - b.orden);
  const esActiva = edicion.id === edicionActiva?.id;

  return (
    <div className="container py-4 py-md-5">
      <PageHeader
        titulo="Categorías"
        subtitulo={`${edicion.nombre} · Elige una categoría para ver sus votaciones.`}
        migas={[{ label: 'Inicio', to: '/' }, { label: `Edición ${edicion.anio}` }]}
      />
      {!esActiva && (
        <div className="alert alert-secondary d-flex align-items-center gap-2 py-2" role="note">
          <i className="bi bi-archive" aria-hidden="true"></i>
          <span>Estás consultando una edición anterior ({edicion.estado === 'cerrada' ? 'cerrada' : edicion.estado}).</span>
        </div>
      )}
      {lista.length === 0 && (
        <div className="card-flv p-4 text-center">
          <i className="bi bi-inbox fs-1 text-secondary" aria-hidden="true"></i>
          <p className="mb-0">Esta edición aún no tiene categorías publicadas.</p>
        </div>
      )}
      <div className="alert aviso-crema d-flex align-items-center gap-2 py-2" role="note">
        <i className="bi bi-exclamation-diamond-fill" aria-hidden="true"></i>
        <span>Categorías ilustrativas – pendientes de validación con la Fundación.</span>
      </div>
      <div className="row g-3">
        {lista.map((c) => {
          const vs = publicas.filter((v) => v.categoriaId === c.id);
          const abiertas = vs.filter((v) => v.estado === 'abierta').length;
          return (
            <div className="col-sm-6 col-lg-4" key={c.id}>
              <Link to={rutas.categoria(c)} className="text-reset text-decoration-none d-block h-100" aria-label={`${c.nombre}: ${vs.length} votaciones, ${abiertas} abiertas`}>
                <article className="card-flv interactiva h-100 p-4">
                  <div className="d-flex align-items-center gap-3 mb-3">
                    <span className="icono-circulo" aria-hidden="true"><i className={`bi bi-${c.icono}`}></i></span>
                    <h2 className="h5 mb-0">{c.nombre}</h2>
                  </div>
                  <p className="small mb-3">{c.descripcion}</p>
                  <div className="d-flex flex-wrap gap-2 small">
                    <span className="badge rounded-pill text-bg-light border">{vs.length} {vs.length === 1 ? 'votación' : 'votaciones'}</span>
                    {abiertas > 0 && <span className="badge badge-estado estado-abierta">{abiertas} abierta{abiertas > 1 ? 's' : ''}</span>}
                  </div>
                  <span className="d-inline-block mt-3 enlace-mas text-rojo">Ver votaciones <i className="bi bi-arrow-right" aria-hidden="true"></i></span>
                </article>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
