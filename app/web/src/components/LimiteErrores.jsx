import { Component } from 'react';
import PaginaError from '../pages/errores/PaginaError.jsx';

/**
 * Atrapa errores de render de una pantalla y muestra la página 500 en lugar de dejar la web en blanco.
 * Se reinicia al cambiar de ruta (Layout le pasa la ruta como `key`).
 */
export default class LimiteErrores extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Error al mostrar la página:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <PaginaError
        codigo={500}
        detalle={import.meta.env.DEV ? String(this.state.error?.message || this.state.error) : undefined}
        onReintentar={() => this.setState({ error: null })}
      />
    );
  }
}
