import { useState } from 'react';

export const VISTAS = [
  { valor: 'mosaico', etiqueta: 'Mosaico', icono: 'grid' },
  { valor: 'tarjetas', etiqueta: 'Tarjetas', icono: 'square' },
  { valor: 'lista', etiqueta: 'Lista', icono: 'list-ul' },
  { valor: 'tabla', etiqueta: 'Tabla', icono: 'table' },
  { valor: 'compacta', etiqueta: 'Compacta', icono: 'view-stacked' },
];

const VALORES = VISTAS.map((v) => v.valor);

/** Vista elegida por el administrador, recordada en este navegador. */
export function useVistaGuardada(clave, porDefecto = 'tabla') {
  const [vista, setVista] = useState(() => {
    try {
      const guardada = localStorage.getItem(`flv_vista_${clave}`);
      return VALORES.includes(guardada) ? guardada : porDefecto;
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

/** Botonera de íconos: Mosaico / Tarjetas / Lista / Tabla / Compacta */
export default function SelectorVista({ valor, onCambio, vistas = VISTAS, etiqueta = 'Forma de ver los datos' }) {
  return (
    <div className="selector-vista" role="group" aria-label={etiqueta}>
      {vistas.map((v) => (
        <button
          key={v.valor}
          type="button"
          className={valor === v.valor ? 'activa' : ''}
          aria-pressed={valor === v.valor}
          onClick={() => onCambio(v.valor)}
          title={`Ver como ${v.etiqueta.toLowerCase()}`}
        >
          <i className={`bi bi-${v.icono}`} aria-hidden="true"></i>
          <span className="visually-hidden">{v.etiqueta}</span>
        </button>
      ))}
    </div>
  );
}
