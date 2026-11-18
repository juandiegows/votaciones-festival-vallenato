import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Cargando from '../components/Cargando.jsx';
import { useSeo } from '../hooks/useSeo.js';

const formatoFecha = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

/** Mi cuenta → Seguridad: verificación en dos pasos (RF-20, CU-15). Mismas reglas que /cuenta/seguridad del portal. */
export default function Seguridad() {
  const { dosPasos } = useApp();
  useSeo({ titulo: 'Seguridad de la cuenta', indexar: false });
  const [estado, setEstado] = useState(null);
  const [configurando, setConfigurando] = useState(null); // { tipo: 'totp', totp } | { tipo: 'correo' }
  const [codigos, setCodigos] = useState(null);
  const [codigo, setCodigo] = useState('');
  const [clave, setClave] = useState({ regenerar: '', desactivar: '' });
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    if (!dosPasos) return;
    const r = await dosPasos.estado();
    if (r.ok) setEstado(r.datos);
    else setError(r.error);
  }, [dosPasos]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const ejecutar = async (accion, alTerminar) => {
    if (enviando) return;
    setEnviando(true);
    setError('');
    setAviso('');
    const r = await accion();
    setEnviando(false);
    if (!r.ok) return setError(r.error);
    return alTerminar(r.datos);
  };

  const conCodigos = (mensaje) => (datos) => {
    setCodigos(datos.codigos_respaldo);
    setEstado(datos.estado);
    setConfigurando(null);
    setCodigo('');
    setClave({ regenerar: '', desactivar: '' });
    setAviso(mensaje);
  };

  const iniciarTotp = () => ejecutar(dosPasos.iniciarTotp, (totp) => { setConfigurando({ tipo: 'totp', totp }); setCodigo(''); });
  const iniciarCorreo = () => ejecutar(dosPasos.iniciarCorreo, () => {
    setConfigurando({ tipo: 'correo' });
    setCodigo('');
    setAviso(`Te enviamos un código a ${estado.correo}.`);
  });
  const activar = (e) => {
    e.preventDefault();
    const accion = configurando.tipo === 'totp' ? dosPasos.activarTotp : dosPasos.activarCorreo;
    ejecutar(() => accion(codigo), conCodigos('La verificación en dos pasos quedó activa.'));
  };
  const regenerar = (e) => {
    e.preventDefault();
    ejecutar(() => dosPasos.regenerarCodigos(clave.regenerar), conCodigos('Generaste nuevos códigos de respaldo: los anteriores ya no sirven.'));
  };
  const desactivar = (e) => {
    e.preventDefault();
    ejecutar(() => dosPasos.desactivar(clave.desactivar), (datos) => {
      setEstado(datos);
      setCodigos(null);
      setClave({ regenerar: '', desactivar: '' });
      setAviso('Desactivaste la verificación en dos pasos.');
    });
  };

  const encabezado = (
    <PageHeader
      titulo="Seguridad de la cuenta"
      subtitulo="Protege tu cuenta con la verificación en dos pasos: además de la contraseña, te pediremos un código al iniciar sesión."
      migas={[{ label: 'Inicio', to: '/' }, { label: 'Seguridad de la cuenta' }]}
    />
  );

  if (!dosPasos) {
    return (
      <div className="container py-4 py-md-5">
        {encabezado}
        <div className="alert alert-info" role="status">
          <i className="bi bi-info-circle me-1" aria-hidden="true"></i>
          La verificación en dos pasos está disponible en el sitio conectado a la API (envía correos y guarda las claves en el servidor). En esta demostración no se puede activar.
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4 py-md-5">
      {encabezado}
      <div className="row justify-content-center">
        <div className="col-lg-10 col-xl-9">
          {aviso && <div className="alert alert-success" role="status">{aviso}</div>}
          {error && <div className="alert alert-danger" role="alert">{error}</div>}

          {codigos && (
            <section className="card-flv p-4 mb-4" aria-labelledby="tituloCodigos">
              <h2 id="tituloCodigos" className="h5"><i className="bi bi-key me-2" aria-hidden="true"></i>Guarda tus códigos de respaldo</h2>
              <p className="small mb-2">
                Úsalos si pierdes el celular o el acceso al correo. Cada código sirve <strong>una sola vez</strong> y <strong>no se volverán a mostrar</strong>: cópialos o imprímelos ahora.
              </p>
              <ul className="list-unstyled row row-cols-2 row-cols-sm-5 g-2 font-monospace mb-3">
                {codigos.map((c) => <li className="col" key={c}><span className="d-block border rounded text-center py-1">{c}</span></li>)}
              </ul>
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => navigator.clipboard?.writeText(codigos.join('\n'))}>
                  <i className="bi bi-clipboard me-1" aria-hidden="true"></i>Copiar
                </button>
                <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => window.print()}>
                  <i className="bi bi-printer me-1" aria-hidden="true"></i>Imprimir
                </button>
              </div>
            </section>
          )}

          <section className="card-flv p-4" aria-labelledby="tituloDosPasos">
            {!estado ? (
              !error && <Cargando texto="Cargando la seguridad de tu cuenta…" />
            ) : (
              <>
                <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                  <h2 id="tituloDosPasos" className="h5 mb-0">Verificación en dos pasos</h2>
                  {estado.activo
                    ? <span className="badge text-bg-success">Activa · {estado.metodo_nombre}</span>
                    : <span className="badge text-bg-secondary">Desactivada</span>}
                </div>

                {estado.activo ? (
                  <>
                    <p className="small mb-1">
                      Activa desde el {formatoFecha.format(new Date(estado.activado_en))}.{' '}
                      {estado.metodo === 'totp'
                        ? 'Al entrar, escribe el código de tu app autenticadora.'
                        : <>Al entrar, te enviaremos un código a <strong>{estado.correo}</strong>.</>}
                    </p>
                    <p className="small">Códigos de respaldo sin usar: <strong>{estado.codigos_respaldo_restantes}</strong>.</p>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <form className="border rounded-3 p-3 h-100" onSubmit={regenerar} noValidate>
                          <h3 className="h6">Nuevos códigos de respaldo</h3>
                          <label htmlFor="claveRegenerar" className="form-label small">Contraseña actual</label>
                          <input id="claveRegenerar" type="password" className="form-control mb-2" autoComplete="current-password"
                            value={clave.regenerar} onChange={(e) => setClave({ ...clave, regenerar: e.target.value })} required />
                          <button type="submit" className="btn btn-outline-primary w-100" disabled={enviando || !clave.regenerar}>Generar códigos</button>
                        </form>
                      </div>
                      <div className="col-md-6">
                        <form className="border rounded-3 p-3 h-100" onSubmit={desactivar} noValidate>
                          <h3 className="h6">Desactivar</h3>
                          <label htmlFor="claveDesactivar" className="form-label small">Contraseña actual</label>
                          <input id="claveDesactivar" type="password" className="form-control mb-2" autoComplete="current-password"
                            value={clave.desactivar} onChange={(e) => setClave({ ...clave, desactivar: e.target.value })} required />
                          <button type="submit" className="btn btn-outline-danger w-100" disabled={enviando || !clave.desactivar}>Desactivar la verificación</button>
                        </form>
                      </div>
                    </div>
                  </>
                ) : configurando ? (
                  <>
                    {configurando.tipo === 'totp' ? (
                      <>
                        <ol className="small ps-3">
                          <li>Instala una app autenticadora: Google Authenticator, Microsoft Authenticator, Authy…</li>
                          <li>En la app, agrega una cuenta y escanea este código QR.</li>
                          <li>Escribe el código de 6 dígitos que muestra la app.</li>
                        </ol>
                        <div className="row g-3 align-items-center">
                          <div className="col-sm-5 text-center">
                            <img src={configurando.totp.qr} width="200" height="200" className="img-fluid border rounded bg-white p-1"
                              alt="Código QR para agregar la cuenta a la app autenticadora" />
                          </div>
                          <div className="col-sm-7">
                            <p className="small mb-1">¿No puedes escanearlo? Escribe esta clave en la app (tipo «basada en tiempo»):</p>
                            <p className="font-monospace fw-semibold user-select-all text-break">{configurando.totp.clave_agrupada}</p>
                            <FormularioCodigo id="codigoTotp" etiqueta="Código de la app" codigo={codigo} setCodigo={setCodigo} onSubmit={activar} enviando={enviando} />
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="small">
                          Te enviamos un código de 6 dígitos a <strong>{estado.correo}</strong> (vence en 10 minutos). Escríbelo para activar este método.
                        </p>
                        <div className="col-md-6 px-0">
                          <FormularioCodigo id="codigoCorreo" etiqueta="Código del correo" codigo={codigo} setCodigo={setCodigo} onSubmit={activar} enviando={enviando} />
                        </div>
                      </>
                    )}
                    <div className="mt-3 d-flex gap-3">
                      {configurando.tipo === 'correo' && <button type="button" className="btn btn-link p-0" onClick={iniciarCorreo} disabled={enviando}>Enviar otro código</button>}
                      <button type="button" className="btn btn-link p-0" onClick={() => { setConfigurando(null); setError(''); setAviso(''); }}>Cancelar</button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="small">Elige cómo quieres recibir el código:</p>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <div className="border rounded-3 p-3 h-100 d-flex flex-column">
                          <h3 className="h6"><i className="bi bi-phone me-2" aria-hidden="true"></i>App autenticadora <span className="badge text-bg-light border">Recomendado</span></h3>
                          <p className="small flex-grow-1">Google Authenticator, Microsoft Authenticator, Authy u otra compatible. Funciona sin internet en el celular.</p>
                          <button type="button" className="btn btn-primary w-100" onClick={iniciarTotp} disabled={enviando}>Configurar app</button>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="border rounded-3 p-3 h-100 d-flex flex-column">
                          <h3 className="h6"><i className="bi bi-envelope me-2" aria-hidden="true"></i>Código por correo</h3>
                          <p className="small flex-grow-1">Te enviamos un código a {estado.correo} cada vez que inicies sesión.</p>
                          <button type="button" className="btn btn-outline-primary w-100" onClick={iniciarCorreo} disabled={enviando || !estado.correo_verificado}>Usar mi correo</button>
                          {!estado.correo_verificado && <p className="small text-danger mt-2 mb-0">Primero confirma tu correo.</p>}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function FormularioCodigo({ id, etiqueta, codigo, setCodigo, onSubmit, enviando }) {
  return (
    <form onSubmit={onSubmit} noValidate>
      <label htmlFor={id} className="form-label">{etiqueta}</label>
      <input id={id} type="text" className="form-control mb-2 text-center fw-semibold" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
        value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
      <button type="submit" className="btn btn-primary w-100" disabled={enviando || codigo.trim().length < 6}>
        {enviando ? 'Activando…' : 'Activar'}
      </button>
    </form>
  );
}
