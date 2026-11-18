/**
 * Paginación de una tabla. Toda tabla paginada lo muestra encima y debajo (`posicion="arriba" | "abajo"`), así
 * no hace falta desplazarse hasta el final para cambiar de página.
 *
 * pagina (desde 1), onCambio(nueva). Se indica `paginas` (total conocido) o `hayMas` (paginación por cursor de la API).
 * `resumen`: texto como «120 registros»; `etiqueta`: nombre de lo que se pagina (para el aria-label).
 * Solo el de abajo anuncia los cambios a los lectores de pantalla, para no repetirlos dos veces.
 */
export default function Paginador({ pagina, paginas, hayMas, onCambio, resumen, etiqueta, posicion = 'abajo', cargando = false }) {
  const hayAnterior = pagina > 1;
  const haySiguiente = paginas ? pagina < paginas : !!hayMas;
  if (!hayAnterior && !haySiguiente && !resumen) return null;
  const texto = `${resumen ? `${resumen} · ` : ''}página ${pagina}${paginas ? ` de ${paginas}` : ''}`;
  return (
    <nav
      className={`paginador d-flex flex-wrap justify-content-between align-items-center gap-2 ${posicion === 'arriba' ? 'mb-2' : 'mt-3'}`}
      aria-label={`Páginas de ${etiqueta} (${posicion === 'arriba' ? 'encima' : 'debajo'} de la tabla)`}
    >
      <span className="small text-secondary-flv" aria-live={posicion === 'abajo' ? 'polite' : undefined}>
        {cargando ? 'Cargando…' : texto.charAt(0).toUpperCase() + texto.slice(1)}
      </span>
      {(hayAnterior || haySiguiente) && (
        <div className="btn-group">
          <button type="button" className="btn btn-sm btn-outline-primary" disabled={!hayAnterior || cargando} onClick={() => onCambio(pagina - 1)}>
            <i className="bi bi-chevron-left me-1" aria-hidden="true"></i>Anterior
          </button>
          <button type="button" className="btn btn-sm btn-outline-primary" disabled={!haySiguiente || cargando} onClick={() => onCambio(pagina + 1)}>
            Siguiente<i className="bi bi-chevron-right ms-1" aria-hidden="true"></i>
          </button>
        </div>
      )}
    </nav>
  );
}
