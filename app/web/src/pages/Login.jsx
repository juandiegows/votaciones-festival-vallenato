import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import Modal from '../components/Modal.jsx';
import { validarCorreo } from '../utils/helpers.js';
import { CREDENCIALES_DEMO } from '../data/credencialesDemo.js';
import { useSeo } from '../hooks/useSeo.js';

export default function Login() {
  const { iniciarSesion, verificarDosPasos, reenviarCodigoDosPasos, configuracion } = useApp();
  useSeo({ titulo: 'Iniciar sesión', indexar: false });
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [recuperar, setRecuperar] = useState(false);
  const [correoRecuperar, setCorreoRecuperar] = useState('');
  const [recuperado, setRecuperado] = useState(false);
  // Paso 2 (verificación en dos pasos): { desafio, metodo } cuando la contraseña fue correcta
  const [paso2, setPaso2] = useState(null);
  const [codigo, setCodigo] = useState('');
  const [aviso2, setAviso2] = useState('');
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
    if (r.requiere2fa) {
      setPaso2({ desafio: r.desafio, metodo: r.metodo });
      setCodigo('');
      setAviso2('');
      return undefined;
    }
    return entrar(r.usuario);
  };

  // Cualquier rol con acceso al panel (panel.ver) entra al panel; los votantes, a las categorías
  const entrar = (u) => {
    const destino = location.state?.desde || (u.permisos?.includes('panel.ver') ? '/panel' : '/categorias');
    navigate(destino, { replace: true });
  };

  const verificar = async (e) => {
    e.preventDefault();
    if (enviando) return;
    if (!codigo.trim()) return setError('Escribe el código de verificación.');
    setEnviando(true);
    setError('');
    const r = await verificarDosPasos(paso2.desafio, codigo);
    setEnviando(false);
    if (r.ok) return entrar(r.usuario);
    // Desafío vencido o inválido: hay que volver a escribir la contraseña
    if (r.codigo === 'desafio_vencido' || r.codigo === 'desafio_invalido') {
      setPaso2(null);
      setContrasena('');
    }
    return setError(r.error);
  };

  const reenviar = async () => {
    setError('');
    const r = await reenviarCodigoDosPasos(paso2.desafio);
    if (r.ok) setAviso2(r.mensaje || 'Te enviamos un código nuevo.');
    else setError(r.error);
  };

  if (paso2) {
    return (
      <div className="container py-4 py-md-5">
        <div className="row justify-content-center">
          <div className="col-md-8 col-lg-6 col-xl-5">
            <div className="card-flv p-4 p-md-5">
              <p className="small text-uppercase fw-semibold text-secondary-flv mb-1"><i className="bi bi-shield-lock me-1" aria-hidden="true"></i>Paso 2 de 2</p>
              <h1 className="h3 mb-1">Verificación en dos pasos</h1>
              {paso2.metodo === 'totp' ? (
                <p className="text-secondary-flv">Abre tu app autenticadora (Google Authenticator, Microsoft Authenticator…) y escribe el código de 6 dígitos de <strong>Votaciones Festival Vallenato</strong>.</p>
              ) : (
                <p className="text-secondary-flv">Te enviamos un código de 6 dígitos a <strong>{correo.trim().toLowerCase()}</strong>. Vence en 10 minutos.</p>
              )}
              {aviso2 && <div className="alert alert-success small" role="status">{aviso2}</div>}
              {error && <div className="alert alert-danger" role="alert">{error}</div>}
              <form noValidate onSubmit={verificar}>
                <div className="mb-3">
                  <label htmlFor="codigo" className="form-label">Código de verificación</label>
                  <input id="codigo" type="text" className="form-control form-control-lg text-center fw-semibold" inputMode="numeric" autoComplete="one-time-code"
                    maxLength={11} autoFocus aria-describedby="ayudaCodigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
                  <div id="ayudaCodigo" className="form-text">¿No tienes acceso? Escribe uno de tus códigos de respaldo (por ejemplo, ABCDE-FGHJK).</div>
                </div>
                <button type="submit" className="btn btn-primary btn-lg w-100" disabled={enviando}>
                  {enviando ? (
                    <><span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Verificando…</>
                  ) : (
                    <><i className="bi bi-check2-circle me-2" aria-hidden="true"></i>Verificar y entrar</>
                  )}
                </button>
              </form>
              {paso2.metodo === 'correo' && (
                <p className="text-center mt-3 mb-0"><button type="button" className="btn btn-link p-0" onClick={reenviar}>¿No te llegó? Enviar otro código</button></p>
              )}
              <p className="text-center mt-3 mb-0">
                <button type="button" className="btn btn-link p-0" onClick={() => { setPaso2(null); setError(''); setContrasena(''); }}>Volver a iniciar sesión</button>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
            <p className="text-secondary-flv">Ingresa para votar y consultar tus comprobantes.</p>
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

            {/* Solo si se permite el ingreso con las cuentas demo y no se apagó su exhibición (falta = activo) */}
            {configuracion?.permitirCuentasDemo !== false && configuracion?.mostrarCredencialesDemo !== false && (
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
            )}
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
            (simulado; en el prototipo no se envían correos).
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
