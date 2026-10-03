import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';

// Barra bajo el menú mientras la cuenta no confirme su correo: sin confirmar no se puede votar
export default function AvisoConfirmarCorreo() {
  const { usuario, reenviarConfirmacion } = useApp();
  const [estado, setEstado] = useState({ enviando: false, mensaje: '', error: false });
  if (!usuario || usuario.correoVerificado !== false) return null;

  const reenviar = async () => {
    setEstado({ enviando: true, mensaje: '', error: false });
    const r = await reenviarConfirmacion();
    setEstado({ enviando: false, mensaje: r.ok ? r.mensaje : r.error, error: !r.ok });
  };

  return (
    <div className="barra-aviso py-2 d-print-none" role="status">
      <div className="container d-flex flex-wrap align-items-center gap-2 small">
        <i className="bi bi-envelope-exclamation-fill" aria-hidden="true"></i>
        <span>
          <strong>Confirma tu correo para poder votar.</strong> Te enviamos un enlace a <strong>{usuario.correo}</strong>.
        </span>
        <button type="button" className="btn btn-sm btn-barra ms-sm-auto" onClick={reenviar} disabled={estado.enviando}>
          {estado.enviando ? 'Enviando…' : 'Reenviar enlace'}
        </button>
        {estado.mensaje && <span className={`w-100 ${estado.error ? 'barra-error' : ''}`} aria-live="polite">{estado.mensaje}</span>}
      </div>
    </div>
  );
}
