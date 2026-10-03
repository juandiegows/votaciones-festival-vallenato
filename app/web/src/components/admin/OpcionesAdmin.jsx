import { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import Avatar from '../Avatar.jsx';
import Modal from '../Modal.jsx';
import ReproductorMultimedia, { fuenteMedio } from '../ReproductorMultimedia.jsx';

/**
 * Opciones de una votación en orden de presentación, con subir/bajar, editar y eliminar.
 * `compacta` muestra una fila corta (para la vista agrupada de «Votaciones»); si no, incluye el reproductor.
 */
export default function OpcionesAdmin({ votacion, onEditar, onMensaje, compacta = false }) {
  const { opciones, votos, eliminarEntidad, reemplazarColeccion } = useApp();
  const [aEliminar, setAEliminar] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const lista = opciones.filter((o) => o.votacionId === votacion.id).sort((a, b) => a.orden - b.orden);
  const votosDe = (opId) => votos.filter((v) => v.opcionId === opId).length;

  const mover = async (indice, delta) => {
    const destino = indice + delta;
    if (destino < 0 || destino >= lista.length) return;
    const nueva = [...lista];
    [nueva[indice], nueva[destino]] = [nueva[destino], nueva[indice]];
    const ordenes = new Map(nueva.map((o, i) => [o.id, i + 1]));
    setProcesando(true);
    // Se envía la colección completa (el modo demostración la reemplaza entera)
    const r = await reemplazarColeccion(
      'opciones',
      opciones.map((o) => (ordenes.has(o.id) ? { ...o, orden: ordenes.get(o.id) } : o)),
      `Reordenó las opciones de "${votacion.titulo}"`
    );
    setProcesando(false);
    if (!r.ok) onMensaje?.({ tipo: 'danger', texto: r.error });
  };

  const pedirEliminar = (o) => {
    if (votosDe(o.id) > 0) return onMensaje?.({ tipo: 'warning', texto: `No se puede eliminar «${o.nombre}»: ya tiene votos registrados.` });
    if (votacion.publicada && lista.length <= 2) {
      return onMensaje?.({ tipo: 'danger', texto: 'No se puede eliminar: una votación publicada debe conservar al menos 2 opciones.' });
    }
    setAEliminar(o);
  };

  const eliminar = async () => {
    setProcesando(true);
    const r = await eliminarEntidad('opciones', aEliminar.id, `Eliminó la opción "${aEliminar.nombre}" de "${votacion.titulo}"`);
    setProcesando(false);
    onMensaje?.(r.ok ? { tipo: 'success', texto: `Opción «${aEliminar.nombre}» eliminada.` } : { tipo: 'danger', texto: r.error });
    setAEliminar(null);
  };

  if (!lista.length) {
    return <p className="small text-secondary-flv mb-0 py-2">Aún no tiene opciones. Agrega al menos 2 para poder publicarla.</p>;
  }

  return (
    <>
      <ol className={`list-unstyled mb-0 ${compacta ? 'opciones-admin-compacta' : 'd-grid gap-2'}`} aria-label={`Opciones de ${votacion.titulo} en orden de presentación`}>
        {lista.map((o, i) => {
          const fuente = fuenteMedio({ audio: o.audio, enlace: o.enlaceMultimedia });
          return (
            <li key={o.id} className={compacta ? 'opcion-admin-fila' : 'card-flv p-3 d-flex flex-wrap align-items-center gap-3'}>
              <span className="fw-bold text-secondary-flv opcion-admin-num">{i + 1}.</span>
              {!compacta && <Avatar nombre={o.nombre} tamano={44} />}
              <div className="flex-grow-1" style={{ minWidth: compacta ? '8rem' : '12rem' }}>
                <p className="fw-semibold mb-0">
                  {o.nombre}
                  {o.activa === false && <span className="badge text-bg-secondary ms-2">Inactiva</span>}
                </p>
                {!compacta && o.descripcion && <p className="small text-secondary-flv mb-0">{o.descripcion}</p>}
                {fuente && (
                  <p className="small mb-0 text-secondary-flv">
                    <i className={`bi bi-${fuente.icono} me-1`} aria-hidden="true"></i>{fuente.etiqueta}
                    {o.textoAudio && <> · <i className="bi bi-card-text me-1" aria-hidden="true"></i>con texto</>}
                  </p>
                )}
                {!compacta && (o.audio || o.enlaceMultimedia) && (
                  <ReproductorMultimedia audio={o.audio} enlace={o.enlaceMultimedia} textoAudio={o.textoAudio} titulo={o.nombre} className="mt-2" />
                )}
              </div>
              <span className="small text-nowrap">{votosDe(o.id)} votos</span>
              <div className="btn-group btn-group-sm" role="group" aria-label={`Acciones para ${o.nombre}`}>
                <button className="btn btn-outline-secondary" disabled={i === 0 || procesando} onClick={() => mover(i, -1)} aria-label={`Subir ${o.nombre}`} title="Subir">
                  <i className="bi bi-arrow-up" aria-hidden="true"></i>
                </button>
                <button className="btn btn-outline-secondary" disabled={i === lista.length - 1 || procesando} onClick={() => mover(i, 1)} aria-label={`Bajar ${o.nombre}`} title="Bajar">
                  <i className="bi bi-arrow-down" aria-hidden="true"></i>
                </button>
                <button className="btn btn-outline-primary" onClick={() => onEditar(o)} aria-label={`Editar ${o.nombre}`} title="Editar">
                  <i className="bi bi-pencil" aria-hidden="true"></i>
                </button>
                <button className="btn btn-outline-danger" onClick={() => pedirEliminar(o)} aria-label={`Eliminar ${o.nombre}`} title="Eliminar">
                  <i className="bi bi-trash" aria-hidden="true"></i>
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      <Modal
        abierto={!!aEliminar}
        titulo="Eliminar opción"
        onCerrar={() => setAEliminar(null)}
        pie={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setAEliminar(null)}>Cancelar</button>
            <button className="btn btn-peligro" disabled={procesando} onClick={eliminar}>Eliminar</button>
          </>
        }
      >
        <p className="mb-0">¿Eliminar la opción «{aEliminar?.nombre}» de «{votacion.titulo}»?</p>
      </Modal>
    </>
  );
}
