import { useState } from 'react';

export const VISTAS = [
  { valor: 'tabla', etiqueta: 'Tabla', icono: 'table' },
  { valor: 'tarjetas', etiqueta: 'Tarjetas', icono: 'grid-3x2-gap' },
  { valor: 'lista', etiqueta: 'Lista', icono: 'list-ul' },
];

/** Vista elegida por el administrador, recordada en este navegador. */
export function useVistaGuardada(clave, porDefecto = 'tabla') {
  const [vista, setVista] = useState(() => {
    try {
      return localStorage.getItem(`flv_vista_${clave}`) || porDefecto;
    } catch {
      return porDefecto;
    }
  });
  const cambiar = (valor) => {
    setVista(valor);
    try {
      localStorage.setItem(`flv_vista_${clave}`, valor);
    } catch {
      /* almacenamiento no disponible */
    }
  };
  return [vista, cambiar];
}

/** Botones Tabla / Tarjetas / Lista */
export default function SelectorVista({ valor, onCambio, vistas = VISTAS, etiqueta = 'Forma de ver los datos' }) {
  return (
    <div className="btn-group btn-group-sm" role="group" aria-label={etiqueta}>
      {vistas.map((v) => (
        <button
          key={v.valor}
          type="button"
          className={`btn ${valor === v.valor ? 'btn-primary' : 'btn-outline-primary'}`}
          aria-pressed={valor === v.valor}
          onClick={() => onCambio(v.valor)}
          title={`Ver como ${v.etiqueta.toLowerCase()}`}
        >
          <i className={`bi bi-${v.icono} me-1`} aria-hidden="true"></i>
          <span className="d-none d-sm-inline">{v.etiqueta}</span>
          <span className="visually-hidden d-sm-none">{v.etiqueta}</span>
        </button>
      ))}
    </div>
  );
}
