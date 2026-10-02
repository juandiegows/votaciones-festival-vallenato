import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import Modal from '../components/Modal.jsx';
import { validarCorreo } from '../utils/helpers.js';
import { CREDENCIALES_DEMO } from '../data/credencialesDemo.js';

export default function Login() {
  const { iniciarSesion } = useApp();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [recuperar, setRecuperar] = useState(false);
  const [correoRecuperar, setCorreoRecuperar] = useState('');
  const [recuperado, setRecuperado] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const aviso = location.state?.aviso;

  const enviar = async (e) => {
    e.preventDefault();
    if (enviando) return;
    if (!correo || !contrasena) return setError('Ingresa tu correo y tu contraseña.');
    setEnviando(true);
    setError('');
    const r = await iniciarSesion(correo, contrasena);
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    const destino = location.state?.desde || (r.usuario.rol === 'administrador' ? '/admin' : '/categorias');
    navigate(destino, { replace: true });
  };

  const usarDemo = (c, p) => {
    setCorreo(c);
    setContrasena(p);
    setError('');
  };

  return (
    <div className="container py-4 py-md-5">
      <div className="row justify-content-center">
        <div className="col-md-8 col-lg-6 col-xl-5">
          <div className="card-flv p-4 p-md-5">
            <h1 className="h3 mb-1">Iniciar sesión</h1>
            <p className="text-secondary-flv">Ingresa para votar y consultar tus comprobantes (RF-02).</p>
            {aviso && (
              <div className="alert alert-info small" role="status">
                <i className="bi bi-info-circle me-1" aria-hidden="true"></i>{aviso}
              </div>
            )}
            {error && <div className="alert alert-danger" role="alert">{error}</div>}
            <form noValidate onSubmit={enviar}>
              <div className="mb-3">
                <label htmlFor="correo" className="form-label">Correo electrónico</label>
                <input id="correo" type="email" className="form-control" autoComplete="email" value={correo} onChange={(e) => setCorreo(e.target.value)} required />
              </div>
              <div className="mb-2">
                <label htmlFor="contrasena" className="form-label">Contraseña</label>
                <input id="contrasena" type="password" className="form-control" autoComplete="current-password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} required />
              </div>
              <div className="text-end mb-3">
                <button type="button" className="btn btn-link p-0 small" onClick={() => { setRecuperar(true); setRecuperado(false); setCorreoRecuperar(correo); }}>
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <button type="submit" className="btn btn-primary btn-lg w-100" disabled={enviando}>
                {enviando ? (
                  <><span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Ingresando…</>
                ) : (
                  <><i className="bi bi-box-arrow-in-right me-2" aria-hidden="true"></i>Ingresar</>
                )}
              </button>
            </form>
            <p className="text-center mt-3">
              ¿No tienes cuenta? <Link to="/registro" state={location.state}>Regístrate</Link>
            </p>

            <div className="border rounded-3 p-3 bg-light small" aria-label="Credenciales de demostración">
              <p className="fw-semibold mb-2"><i className="bi bi-key me-1" aria-hidden="true"></i>Credenciales de demostración</p>
              <div className="d-flex flex-column gap-2">
                {CREDENCIALES_DEMO.map((c) => (
                  <button key={c.correo} type="button" className="btn btn-sm btn-outline-primary text-start" onClick={() => usarDemo(c.correo, c.contrasena)}>
                    <strong>{c.rol}:</strong> {c.correo} / {c.contrasena}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        abierto={recuperar}
        titulo="Recuperar contraseña"
        onCerrar={() => setRecuperar(false)}
        pie={
          recuperado ? (
            <button className="btn btn-primary" onClick={() => setRecuperar(false)}>Cerrar</button>
          ) : (
            <>
              <button className="btn btn-outline-secondary" onClick={() => setRecuperar(false)}>Cancelar</button>
              <button className="btn btn-primary" disabled={!validarCorreo(correoRecuperar)} onClick={() => setRecuperado(true)}>
                Enviar enlace
              </button>
            </>
          )
        }
      >
        {recuperado ? (
          <div className="alert alert-success mb-0" role="status">
            <i className="bi bi-envelope-check me-1" aria-hidden="true"></i>
            Si <strong>{correoRecuperar}</strong> está registrado, recibirás un enlace para restablecer tu contraseña
            (simulado – RF-03; en el prototipo no se envían correos).
          </div>
        ) : (
          <>
            <p className="small">Escribe el correo con el que te registraste y te enviaremos un enlace de recuperación.</p>
            <label htmlFor="correoRecuperar" className="form-label">Correo electrónico</label>
            <input id="correoRecuperar" type="email" className="form-control" value={correoRecuperar} onChange={(e) => setCorreoRecuperar(e.target.value)} />
          </>
        )}
      </Modal>
    </div>
  );
}
