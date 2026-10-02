import { useEffect, useId, useRef } from 'react';

// Modal accesible controlado por React (usa clases de Bootstrap, sin su JS)
export default function Modal({ abierto, titulo, onCerrar, children, pie, tamano = '' }) {
  const id = useId();
  const ref = useRef(null);
  const cerrarRef = useRef(onCerrar);
  cerrarRef.current = onCerrar;

  useEffect(() => {
    if (!abierto) return undefined;
    const previo = document.activeElement;
    document.body.classList.add('overflow-hidden');
    const foco = ref.current?.querySelector('input, select, textarea, .modal-footer button') || ref.current;
    foco?.focus();
    const onKey = (e) => e.key === 'Escape' && cerrarRef.current();
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('overflow-hidden');
      document.removeEventListener('keydown', onKey);
      previo?.focus?.();
    };
  }, [abierto]);

  if (!abierto) return null;
  return (
    <>
      <div className="modal-backdrop-flv" onClick={onCerrar} aria-hidden="true"></div>
      <div className="modal d-block" role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}>
        <div className={`modal-dialog modal-dialog-centered modal-dialog-scrollable ${tamano}`}>
          <div className="modal-content" ref={ref} tabIndex={-1}>
            <div className="modal-header">
              <h2 className="modal-title h5 mb-0" id={id}>{titulo}</h2>
              <button type="button" className="btn-close" aria-label="Cerrar" onClick={onCerrar}></button>
            </div>
            <div className="modal-body">{children}</div>
            {pie && <div className="modal-footer">{pie}</div>}
          </div>
        </div>
      </div>
    </>
  );
}
