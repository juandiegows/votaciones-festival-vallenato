import PaginaError from './errores/PaginaError.jsx';

// 404: ruta inexistente o recurso (edición, categoría, votación) que no se encontró
export default function NoEncontrado({ mensaje }) {
  return <PaginaError codigo={404} mensaje={mensaje} />;
}
