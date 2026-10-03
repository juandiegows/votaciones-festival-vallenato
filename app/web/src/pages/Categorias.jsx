import { useApp } from '../context/AppContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import CategoriasEdicion from '../components/presentaciones/CategoriasEdicion.jsx';
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
      <CategoriasEdicion
        presentacion={edicion.presentacionCategorias}
        items={lista.map((c) => {
          const vs = publicas.filter((v) => v.categoriaId === c.id);
          return { categoria: c, ruta: rutas.categoria(c), total: vs.length, abiertas: vs.filter((v) => v.estado === 'abierta').length };
        })}
      />
    </div>
  );
}
