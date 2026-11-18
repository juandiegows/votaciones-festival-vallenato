import { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { MODO_API } from '../../config.js';
import Modal from '../Modal.jsx';

/** Modal para descargar la plantilla de Excel y crear una edición completa subiéndola llena. */
export default function ImportarEdicion({ abierto, onCerrar, onImportada }) {
  const { descargarPlantillaEdicion, importarEdicion } = useApp();
  const [archivo, setArchivo] = useState(null);
  const [activar, setActivar] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');
  const [errores, setErrores] = useState([]);

  const cerrar = () => {
    setArchivo(null);
    setActivar(false);
    setError('');
    setErrores([]);
    onCerrar();
  };

  const plantilla = async () => {
    const r = await descargarPlantillaEdicion();
    if (!r.ok) setError(r.error);
  };

  const importar = async (e) => {
    e.preventDefault();
    if (!archivo) return setError('Elige la plantilla de Excel que vas a subir.');
    setProcesando(true);
    const r = await importarEdicion(archivo, activar);
    setProcesando(false);
    if (!r.ok) {
      setError(r.error);
      setErrores(r.errores || []);
      return;
    }
    const d = r.resumen;
    onImportada?.(`Edición «${d.nombre}» importada: ${d.categorias} categoría(s), ${d.votaciones} votación(es) en borrador y ${d.opciones} opción(es).${d.estado === 'activa' ? '' : ' Quedó cerrada: actívala cuando esté lista.'}`);
    cerrar();
  };

  return (
    <Modal
      abierto={abierto}
      tamano="modal-lg"
      titulo="Importar una edición desde Excel"
      onCerrar={cerrar}
      pie={
        <>
          <button className="btn btn-outline-secondary" onClick={cerrar}>Cancelar</button>
          <button className="btn btn-primary" type="submit" form="form-importar-edicion" disabled={procesando || !MODO_API}>
            <i className="bi bi-upload me-1" aria-hidden="true"></i>{procesando ? 'Importando…' : 'Importar edición'}
          </button>
        </>
      }
    >
      <form id="form-importar-edicion" noValidate onSubmit={importar}>
        {!MODO_API && (
          <div className="alert alert-info small" role="note">
            <i className="bi bi-info-circle me-1" aria-hidden="true"></i>La plantilla y la importación las procesa el servidor: están disponibles en
            producción (votaciones.juandiegows.com), no en el modo demostración.
          </div>
        )}
        <ol className="small">
          <li>Descarga la plantilla y llena las hojas «Edición», «Categorías», «Votaciones» y «Opciones».</li>
          <li>Borra la fila de ejemplo de cada hoja.</li>
          <li>Súbela aquí. Si alguna fila tiene un error no se crea nada y verás la hoja y la fila que debes corregir.</li>
        </ol>
        <button type="button" className="btn btn-outline-primary btn-sm mb-3" onClick={plantilla} disabled={!MODO_API}>
          <i className="bi bi-file-earmark-arrow-down me-1" aria-hidden="true"></i>Descargar plantilla (.xlsx)
        </button>
        <div className="mb-3">
          <label className="form-label" htmlFor="imp-archivo">Plantilla llena</label>
          <input id="imp-archivo" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="form-control"
            onChange={(e) => { setArchivo(e.target.files?.[0] || null); setError(''); setErrores([]); }} aria-describedby="imp-ayuda" />
          <div id="imp-ayuda" className="form-text">Excel (.xlsx) de hasta 5 MB. Las votaciones se crean en borrador; imágenes y audios se suben después.</div>
        </div>
        <div className="form-check form-switch mb-2">
          <input className="form-check-input" type="checkbox" role="switch" id="imp-activar" checked={activar} onChange={(e) => setActivar(e.target.checked)} />
          <label className="form-check-label" htmlFor="imp-activar">Activarla al importar <span className="text-secondary-flv">(cierra la edición activa actual)</span></label>
        </div>
        {error && <div className="alert alert-danger py-2 mt-3 mb-2" role="alert">{error}</div>}
        {errores.length > 0 && (
          <div className="table-responsive">
            <table className="table table-sm small align-middle mb-0">
              <caption className="visually-hidden">Errores de la plantilla</caption>
              <thead><tr><th scope="col">Hoja</th><th scope="col">Fila</th><th scope="col">Problema</th></tr></thead>
              <tbody>
                {errores.map((x, i) => <tr key={i}><td>{x.hoja || '—'}</td><td>{x.fila ?? '—'}</td><td>{x.mensaje}</td></tr>)}
              </tbody>
            </table>
          </div>
        )}
      </form>
    </Modal>
  );
}
