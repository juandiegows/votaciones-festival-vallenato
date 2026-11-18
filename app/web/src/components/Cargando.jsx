import AcordeonAnimado from './AcordeonAnimado.jsx';

/**
 * Indicador de carga: un acordeón vallenato que abre y cierra el fuelle mientras suenan notas.
 * `compacto` para cargas dentro de una sección (acordeón pequeño al lado del texto).
 */
export default function Cargando({ texto = 'Cargando…', compacto = false, className = '' }) {
  return (
    <div className={`cargando-acordeon ${compacto ? 'cargando-acordeon-compacto' : ''} ${className}`} role="status" aria-live="polite">
      <AcordeonAnimado decorativo />
      <span className="cargando-acordeon-texto">{texto}</span>
    </div>
  );
}
