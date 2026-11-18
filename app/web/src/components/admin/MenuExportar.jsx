import { useEffect, useId, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { MODO_API } from '../../config.js';

export const FORMATOS_EXPORTACION = [
  { valor: 'pdf', etiqueta: 'PDF', icono: 'file-earmark-pdf' },
  { valor: 'excel', etiqueta: 'Excel (.xlsx)', icono: 'file-earmark-excel' },
  { valor: 'csv', etiqueta: 'CSV', icono: 'filetype-csv' },
  { valor: 'json', etiqueta: 'JSON', icono: 'filetype-json' },
  { valor: 'sql', etiqueta: 'SQL (MySQL)', icono: 'filetype-sql' },
];

/**
 * Menú «Exportar» con los resultados de una votación, categoría o edición en PDF, Excel, CSV, JSON o SQL.
 * Con `estructura`, agrega la edición completa en la plantilla de Excel. `onResultado({ tipo, texto })` informa el resultado.
 */
export default function MenuExportar({ coleccion, id, nombre, estructura = false, clase = 'btn-outline-secondary', onResultado }) {
  const { exportar, exportarEstructuraEdicion } = useApp();
  const [abierto, setAbierto] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const ref = useRef(null);
  const idMenu = useId();

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => !ref.current?.contains(e.target) && setAbierto(false);
    const tecla = (e) => e.key === 'Escape' && setAbierto(false);
    document.addEventListener('mousedown', fuera);
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('keydown', tecla);
    };
  }, [abierto]);

  const ejecutar = async (accion, formato) => {
    setAbierto(false);
    setProcesando(true);
    const r = await accion();
    setProcesando(false);
    if (!onResultado) return;
    if (!r.ok) onResultado({ tipo: 'danger', texto: r.error });
    else if (formato === 'pdf' && !MODO_API) onResultado({ tipo: 'success', texto: 'Reporte abierto: en el diálogo de impresión elige «Guardar como PDF».' });
    else onResultado({ tipo: 'success', texto: `Archivo ${r.nombre} descargado.` });
  };

  return (
    <div className="dropdown d-inline-block me-1" ref={ref}>
      <button
        type="button"
        className={`btn btn-sm ${clase} dropdown-toggle`}
        aria-expanded={abierto}
        aria-controls={idMenu}
        aria-label={`Exportar resultados de ${nombre}`}
        disabled={procesando}
        onClick={() => setAbierto((a) => !a)}
      >
        <i className="bi bi-download me-1" aria-hidden="true"></i>{procesando ? 'Generando…' : 'Exportar'}
      </button>
      <ul id={idMenu} className={`dropdown-menu dropdown-menu-end ${abierto ? 'show' : ''}`}>
        <li><h3 className="dropdown-header">Resultados</h3></li>
        {FORMATOS_EXPORTACION.map((f) => (
          <li key={f.valor}>
            <button type="button" className="dropdown-item" onClick={() => ejecutar(() => exportar(coleccion, id, f.valor), f.valor)}>
              <i className={`bi bi-${f.icono} me-2`} aria-hidden="true"></i>{f.etiqueta}
            </button>
          </li>
        ))}
        {estructura && (
          <>
            <li><hr className="dropdown-divider" /></li>
            <li><h3 className="dropdown-header">Edición completa</h3></li>
            <li>
              <button type="button" className="dropdown-item" onClick={() => ejecutar(() => exportarEstructuraEdicion(id), 'excel')}>
                <i className="bi bi-file-earmark-spreadsheet me-2" aria-hidden="true"></i>Plantilla de Excel con los datos
              </button>
            </li>
          </>
        )}
      </ul>
    </div>
  );
}
