import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

/**
 * Tabla que muestra solo las columnas que caben en el ancho disponible; las demás se ven al desplegar cada fila.
 *
 * columnas: [{ id, titulo, celda(fila, i), claseTh, claseTd, minimo, prioridad }]
 *   prioridad 0 = siempre visible; entre mayor el número, antes se oculta (empate: la de más a la derecha).
 *   minimo = ancho mínimo de la columna (p. ej. '12rem'), para no apretar el texto antes de ocultar otras.
 * filas, clave(fila) e nombreFila(fila) (para el botón de desplegar). Opcionales: titulo (caption), vacio,
 * claseTabla, claseContenedor, claseFila(fila), despuesDeFila(fila, columnasVisibles) y ocupado (aria-busy).
 */
export default function TablaResponsiva({
  columnas, filas, clave, nombreFila, titulo, vacio, claseTabla = '', claseContenedor = 'card-flv',
  claseFila, despuesDeFila, ocupado,
}) {
  const contenedorRef = useRef(null);
  const idBase = useId();
  const [ancho, setAncho] = useState(0);
  const [ocultas, setOcultas] = useState([]);
  const [abiertas, setAbiertas] = useState(() => new Set());

  // Si cambia el ancho, la cantidad de filas o las columnas, se vuelve a medir desde cero
  const firma = `${ancho}|${filas.length}|${columnas.map((c) => c.id).join(',')}`;
  const [firmaMedida, setFirmaMedida] = useState(firma);
  if (firma !== firmaMedida) {
    setFirmaMedida(firma);
    setOcultas([]);
  }

  useEffect(() => {
    const el = contenedorRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observador = new ResizeObserver(([entrada]) => setAncho(Math.round(entrada.contentRect.width)));
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  // Oculta una columna por pasada (antes de pintar) hasta que la tabla deje de desbordar
  useLayoutEffect(() => {
    const el = contenedorRef.current;
    if (!el || el.scrollWidth <= el.clientWidth + 1) return;
    const siguiente = columnas
      .map((c, i) => ({ ...c, i }))
      .filter((c) => (c.prioridad ?? 2) > 0 && !ocultas.includes(c.id))
      .sort((a, b) => (b.prioridad ?? 2) - (a.prioridad ?? 2) || b.i - a.i)[0];
    if (siguiente) setOcultas([...ocultas, siguiente.id]);
  }, [ocultas, firmaMedida, columnas]);

  const visibles = columnas.filter((c) => !ocultas.includes(c.id));
  const escondidas = columnas.filter((c) => ocultas.includes(c.id));
  const conDetalle = escondidas.length > 0;
  const totalColumnas = visibles.length + (conDetalle ? 1 : 0);

  const alternar = (k) => setAbiertas((prev) => {
    const nuevo = new Set(prev);
    if (nuevo.has(k)) nuevo.delete(k);
    else nuevo.add(k);
    return nuevo;
  });

  return (
    <div ref={contenedorRef} className={`table-responsive ${claseContenedor}`}>
      <table className={`table table-flv align-middle mb-0 ${claseTabla}`}>
        {titulo && <caption className="visually-hidden">{titulo}</caption>}
        <thead>
          <tr>
            {conDetalle && <th scope="col" className="col-detalle"><span className="visually-hidden">Más datos</span></th>}
            {visibles.map((c) => (
              <th key={c.id} scope="col" className={c.claseTh} style={c.minimo ? { minWidth: c.minimo } : undefined}>{c.titulo}</th>
            ))}
          </tr>
        </thead>
        <tbody aria-busy={ocupado || undefined}>
          {filas.map((f, i) => {
            const k = clave(f);
            const abierta = conDetalle && abiertas.has(k);
            const idDetalle = `${idBase}-detalle-${k}`;
            return (
              <Fragment key={k}>
                <tr className={`${claseFila?.(f) ?? ''} ${abierta ? 'fila-abierta' : ''}`}>
                  {conDetalle && (
                    <td className="col-detalle">
                      <button
                        type="button"
                        className="btn-detalle"
                        aria-expanded={abierta}
                        aria-controls={idDetalle}
                        aria-label={`${abierta ? 'Ocultar' : 'Ver'} más datos de ${nombreFila(f)}`}
                        onClick={() => alternar(k)}
                      >
                        <i className={`bi ${abierta ? 'bi-dash-circle-fill' : 'bi-plus-circle-fill'}`} aria-hidden="true"></i>
                      </button>
                    </td>
                  )}
                  {visibles.map((c) => (
                    <td key={c.id} className={c.claseTd} style={c.minimo ? { minWidth: c.minimo } : undefined}>{c.celda(f, i)}</td>
                  ))}
                </tr>
                {abierta && (
                  <tr className="fila-detalle" id={idDetalle}>
                    <td colSpan={totalColumnas}>
                      <dl className="detalle-tabla mb-0">
                        {escondidas.map((c) => (
                          <div key={c.id} className="detalle-tabla-item">
                            <dt>{c.titulo}</dt>
                            <dd>{c.celda(f, i)}</dd>
                          </div>
                        ))}
                      </dl>
                    </td>
                  </tr>
                )}
                {despuesDeFila?.(f, totalColumnas)}
              </Fragment>
            );
          })}
          {filas.length === 0 && vacio && (
            <tr><td colSpan={totalColumnas} className="text-center py-4">{vacio}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
