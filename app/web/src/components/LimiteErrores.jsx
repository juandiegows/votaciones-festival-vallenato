import { Component } from 'react';
import PaginaError from '../pages/errores/PaginaError.jsx';
import { reportarError } from '../api/registroErrores.js';
import { BASE_URL, MODO_API } from '../config.js';

const recargar = () => window.location.reload();

/**
 * ErrorBoundary: atrapa errores de render y muestra la página 500 con la marca en lugar de dejar la web en blanco.
 * El error se envía a los registros del sistema (con el componentStack de React) cuando hay API.
 *  - Por pantalla: Layout lo usa con la ruta como `key` (se reinicia al cambiar de ruta).
 *  - Global (`independiente`): en main.jsx, alrededor de toda la app; a pantalla completa, sin navbar ni pie,
 *    porque el error pudo ocurrir en ellos o en los proveedores de datos.
 */
export default class LimiteErrores extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Error al mostrar la página:', error, info?.componentStack);
    reportarError(error, { componentes: info?.componentStack });
  }

  render() {
    if (!this.state.error) return this.props.children;
    const { independiente = false } = this.props;
    const sugerencias = MODO_API
      ? ['Recarga la página.', 'Si el problema continúa, vuelve más tarde: el error ya quedó registrado para el equipo técnico.']
      : undefined;
    return (
      <PaginaError
        codigo={500}
        independiente={independiente}
        sugerencias={sugerencias}
        detalle={import.meta.env.DEV ? String(this.state.error?.message || this.state.error) : undefined}
        onReintentar={independiente ? recargar : () => this.setState({ error: null })}
        acciones={independiente ? (
          <>
            <button type="button" className="btn btn-primary" onClick={recargar}>
              <i className="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Reintentar
            </button>
            {/* Enlace normal (no del enrutador): vuelve a cargar la app desde cero */}
            <a href={BASE_URL} className="btn btn-outline-primary">
              <i className="bi bi-house me-1" aria-hidden="true"></i>Volver al inicio
            </a>
          </>
        ) : undefined}
      />
    );
  }
}
