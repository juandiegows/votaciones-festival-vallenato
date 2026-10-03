/**
 * Ícono de una categoría o votación: la imagen subida por el administrador (si existe)
 * o el ícono de Bootstrap Icons elegido. Decorativo salvo que se indique `etiqueta`.
 */
export default function IconoEntidad({ icono, imagen, etiqueta, className = '', tamano }) {
  const estilo = tamano ? { width: tamano, height: tamano } : undefined;
  if (imagen) {
    return (
      <img
        src={imagen}
        alt={etiqueta || ''}
        aria-hidden={etiqueta ? undefined : 'true'}
        className={`icono-entidad-img ${className}`}
        style={estilo}
        loading="lazy"
      />
    );
  }
  return (
    <i
      className={`bi bi-${icono || 'check2-square'} ${className}`}
      role={etiqueta ? 'img' : undefined}
      aria-label={etiqueta || undefined}
      aria-hidden={etiqueta ? undefined : 'true'}
    ></i>
  );
}
