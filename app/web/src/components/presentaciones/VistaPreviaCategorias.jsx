import { useApp } from '../../context/AppContext.jsx';
import { CATEGORIAS_EJEMPLO } from '../../data/presentaciones.js';
import { votacionesPublicas } from '../../utils/visibilidad.js';
import CategoriasEdicion from './CategoriasEdicion.jsx';

/** Así verá el público las categorías con la presentación elegida (las reales si ya hay dos, si no, las de ejemplo). */
export default function VistaPreviaCategorias({ edicion, presentacion }) {
  const datos = useApp();
  const reales = datos.categorias
    .filter((c) => c.activa && c.edicionId === edicion.id)
    .sort((a, b) => a.orden - b.orden)
    .slice(0, 6);
  const sonReales = reales.length >= 2;
  const publicas = sonReales ? votacionesPublicas(datos, edicion) : [];
  // Sin `ruta`, las categorías no llevan a ninguna parte: la vista previa no saca al administrador del formulario
  const items = sonReales
    ? reales.map((c) => {
      const propias = publicas.filter((v) => v.categoriaId === c.id);
      return { categoria: c, total: propias.length, abiertas: propias.filter((v) => v.estado === 'abierta').length };
    })
    : CATEGORIAS_EJEMPLO.map(({ total, abiertas, ...c }) => ({ categoria: c, total, abiertas }));

  return (
    <div className="mt-3">
      <p className="small fw-semibold mb-2">
        <i className="bi bi-eye me-1" aria-hidden="true"></i>Vista previa: así verá el público
        {sonReales ? ' las categorías de esta edición' : ' las categorías (con categorías de ejemplo)'}.
      </p>
      <div className="vista-previa-marco" aria-label="Vista previa de la presentación">
        <CategoriasEdicion items={items} presentacion={presentacion} />
      </div>
    </div>
  );
}
