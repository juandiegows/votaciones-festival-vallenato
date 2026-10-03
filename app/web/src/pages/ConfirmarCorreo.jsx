import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { useSeo } from '../hooks/useSeo.js';

// Destino del enlace del correo de confirmación: /confirmar-correo?token=…
export default function ConfirmarCorreo() {
  const { confirmarCorreo, usuario } = useApp();
  useSeo({ titulo: 'Confirmar correo', indexar: false });
  const [parametros] = useSearchParams();
  const token = parametros.get('token') || '';
  const [resultado, setResultado] = useState(token ? null : { ok: false, error: 'El enlace de confirmación está incompleto.' });
  const enviado = useRef(false);

  useEffect(() => {
    if (!token || enviado.current) return;
    enviado.current = true;
    confirmarCorreo(token).then(setResultado);
  }, [token, confirmarCorreo]);

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-8 col-lg-6">
          <section className="card-flv p-4 p-md-5 text-center" aria-live="polite">
            {!resultado && (
              <>
                <span className="spinner-border text-primary" aria-hidden="true"></span>
                <p className="mt-3 mb-0">Confirmando tu correo…</p>
              </>
            )}
            {resultado?.ok && (
              <>
                <i className="bi bi-patch-check-fill display-4 text-success" aria-hidden="true"></i>
                <h1 className="h3 mt-2">¡Correo confirmado!</h1>
                <p>Tu cuenta <strong>{resultado.usuario?.correo}</strong> ya puede votar. Te enviamos un correo de bienvenida.</p>
                <Link to={usuario ? '/categorias' : '/login'} className="btn btn-primary">
                  {usuario ? 'Ir a votar' : 'Iniciar sesión'}
                </Link>
              </>
            )}
            {resultado && !resultado.ok && (
              <>
                <i className="bi bi-x-octagon-fill display-4 text-danger" aria-hidden="true"></i>
                <h1 className="h3 mt-2">No pudimos confirmar tu correo</h1>
                <p>{resultado.error}</p>
                <p className="small text-secondary-flv">
                  {usuario ? 'Pide un enlace nuevo con «Reenviar enlace» en la barra amarilla de arriba.' : 'Inicia sesión y pide un enlace nuevo.'}
                </p>
                {!usuario && <Link to="/login" className="btn btn-primary">Iniciar sesión</Link>}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
