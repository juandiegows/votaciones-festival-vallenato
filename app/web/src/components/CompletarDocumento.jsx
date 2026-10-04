import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import Modal from './Modal.jsx';
import { TIPOS_DOCUMENTO, errorDocumento } from '../utils/documento.js';

/**
 * Ventana para registrar el documento antes de votar. Aparece cuando la administración empezó a pedir documento
 * y la cuenta se creó sin él; al guardarlo llama a onListo para seguir con el voto.
 */
export default function CompletarDocumento({ abierto, onCerrar, onListo }) {
  const { completarDocumento } = useApp();
  const [tipo, setTipo] = useState('CC');
  const [numero, setNumero] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const guardar = async (e) => {
    e?.preventDefault();
    const invalido = errorDocumento(tipo, numero);
    if (invalido) {
      setError(invalido);
      document.getElementById('doc-numero')?.focus();
      return;
    }
    setEnviando(true);
    const r = await completarDocumento(tipo, numero);
    setEnviando(false);
    if (!r.ok) return setError(r.errores?.numeroDocumento || r.error);
    setNumero('');
    setError('');
    onListo();
  };

  return (
    <Modal
      abierto={abierto}
      titulo="Completa tu documento para votar"
      onCerrar={onCerrar}
      pie={
        <>
          <button type="button" className="btn btn-outline-secondary" onClick={onCerrar} disabled={enviando}>Cancelar</button>
          <button type="submit" form="form-documento" className="btn btn-primary" disabled={enviando}>
            {enviando ? <><span className="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Guardando…</> : 'Guardar y continuar'}
          </button>
        </>
      }
    >
      <p className="mb-3">
        Para votar en esta edición se pide el documento de identidad: una cuenta por persona. Lo registras una sola vez.
      </p>
      <form id="form-documento" noValidate onSubmit={guardar}>
        <div className="mb-3">
          <label htmlFor="doc-tipo" className="form-label">Tipo de documento</label>
          <select id="doc-tipo" className="form-select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS_DOCUMENTO.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
          </select>
        </div>
        <label htmlFor="doc-numero" className="form-label">Número de documento</label>
        <input
          id="doc-numero"
          className={`form-control ${error ? 'is-invalid' : ''}`}
          value={numero}
          onChange={(e) => { setNumero(e.target.value); if (error) setError(''); }}
          inputMode={['CC', 'TI'].includes(tipo) ? 'numeric' : 'text'}
          autoComplete="off"
          aria-invalid={!!error}
          aria-describedby={error ? 'doc-error' : 'doc-ayuda'}
        />
        {error
          ? <div id="doc-error" className="invalid-feedback">{error}</div>
          : <div id="doc-ayuda" className="form-text">Sin puntos ni espacios.</div>}
      </form>
    </Modal>
  );
}
