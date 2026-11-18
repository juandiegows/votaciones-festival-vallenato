import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { MODO_API } from '../../config.js';

/**
 * Configuración → Demostración: permitir el ingreso con las cuentas de demostración y eliminar o volver a cargar los
 * datos que crea cargar_demo. Con la API, eliminar y recargar exigen una cuenta de administrador propia.
 */
export default function SeccionDemo() {
  const { configuracion, guardarConfiguracion, obtenerDemo, eliminarDemo, cargarDemo, restablecer } = useApp();
  const [demo, setDemo] = useState(null);
  const [estado, setEstado] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [confirmacion, setConfirmacion] = useState({ eliminar: '', cargar: '' });
  const permitidas = configuracion?.permitirCuentasDemo ?? true;

  const consultar = useCallback(async () => {
    if (!obtenerDemo) return;
    const r = await obtenerDemo();
    if (r.ok) setDemo(r.datos);
  }, [obtenerDemo]);

  useEffect(() => {
    consultar();
  }, [consultar]);

  const ejecutar = async (accion, exito) => {
    setProcesando(true);
    setEstado({ tipo: 'info', texto: 'Procesando…' });
    const r = await accion();
    setProcesando(false);
    setEstado(r.ok ? { tipo: 'success', texto: typeof exito === 'function' ? exito(r) : exito } : { tipo: 'danger', texto: r.error });
    if (r.ok) {
      setConfirmacion({ eliminar: '', cargar: '' });
      consultar();
    }
  };

  const alternar = (valor) => ejecutar(
    () => guardarConfiguracion({ ...configuracion, permitirCuentasDemo: valor }),
    valor ? 'Las cuentas de demostración pueden volver a iniciar sesión.' : 'Las cuentas de demostración ya no pueden iniciar sesión.',
  );

  const bloqueado = procesando || demo?.esCuentaDemo;

  return (
    <>
      <section className="card-flv p-3 p-md-4 mb-3" aria-labelledby="cfg-cuentas-demo">
        <h2 id="cfg-cuentas-demo" className="h5 mb-3">Cuentas de demostración</h2>
        <div className="form-check form-switch">
          <input className="form-check-input" type="checkbox" role="switch" id="cfg-permitir-demo" checked={permitidas} disabled={procesando}
            onChange={(e) => alternar(e.target.checked)} aria-describedby="cfg-permitir-demo-ayuda" />
          <label className="form-check-label fw-semibold" htmlFor="cfg-permitir-demo">Permitir el ingreso con las cuentas de demostración</label>
        </div>
        <p id="cfg-permitir-demo-ayuda" className="small text-secondary-flv mb-0 mt-1">
          admin@festival.test, votante@festival.test y las cuentas @demo.festival.test. Apagada, no pueden iniciar sesión y el login no muestra sus
          credenciales. Para apagarla necesitas una cuenta de administrador propia.
        </p>
      </section>

      <section className="card-flv p-3 p-md-4" aria-labelledby="cfg-datos-demo">
        <h2 id="cfg-datos-demo" className="h5 mb-1">Datos de demostración</h2>
        {MODO_API ? (
          <>
            <p className="small text-secondary-flv">
              {demo ? `Ahora hay ${demo.ediciones} edición(es) de demostración (${demo.anios.join(', ')}), ${demo.usuarios} cuenta(s) y ${demo.votos} voto(s). ` : ''}
              El contacto, las redes, la marca y esta configuración se conservan. Las ediciones y cuentas creadas por la administración no se tocan.
            </p>
            {demo?.esCuentaDemo && (
              <div className="alert alert-warning small" role="note">
                <i className="bi bi-exclamation-triangle me-1" aria-hidden="true"></i>Estás usando una cuenta de demostración: para eliminar o recargar los datos inicia sesión con una cuenta de administrador propia.
              </div>
            )}
            <div className="row g-3">
              <div className="col-md-6">
                <form className="border rounded-3 p-3 h-100" noValidate onSubmit={(e) => {
                  e.preventDefault();
                  if (confirmacion.eliminar.trim().toUpperCase() !== 'ELIMINAR') return setEstado({ tipo: 'danger', texto: 'Escribe ELIMINAR para confirmar.' });
                  ejecutar(eliminarDemo, (r) => `Datos de demostración eliminados: ${r.resultado.ediciones} edición(es), ${r.resultado.usuarios} cuenta(s) y ${r.resultado.votos} voto(s).`);
                }}>
                  <p className="fw-semibold mb-1"><i className="bi bi-trash me-1 text-danger" aria-hidden="true"></i>Eliminar los datos de demostración</p>
                  <p className="small text-secondary-flv">Borra las ediciones de demostración con sus categorías, votaciones, opciones, banners y votos, y las cuentas de demostración.</p>
                  <label className="form-label small" htmlFor="demo-eliminar">Escribe <strong>ELIMINAR</strong> para confirmar</label>
                  <input id="demo-eliminar" className="form-control form-control-sm mb-2" autoComplete="off" value={confirmacion.eliminar} onChange={(e) => setConfirmacion({ ...confirmacion, eliminar: e.target.value })} />
                  <button className="btn btn-outline-danger btn-sm" type="submit" disabled={bloqueado}>Eliminar datos de demostración</button>
                </form>
              </div>
              <div className="col-md-6">
                <form className="border rounded-3 p-3 h-100" noValidate onSubmit={(e) => {
                  e.preventDefault();
                  if (confirmacion.cargar.trim().toUpperCase() !== 'CARGAR') return setEstado({ tipo: 'danger', texto: 'Escribe CARGAR para confirmar.' });
                  ejecutar(cargarDemo, (r) => r.resultado || 'Datos de demostración cargados.');
                }}>
                  <p className="fw-semibold mb-1"><i className="bi bi-arrow-repeat me-1 text-rojo" aria-hidden="true"></i>Volver a cargar los datos de demostración</p>
                  <p className="small text-secondary-flv">Borra los datos de demostración que haya y los crea de nuevo con fechas al día. La edición 2027 de demostración queda activa.</p>
                  <label className="form-label small" htmlFor="demo-cargar">Escribe <strong>CARGAR</strong> para confirmar</label>
                  <input id="demo-cargar" className="form-control form-control-sm mb-2" autoComplete="off" value={confirmacion.cargar} onChange={(e) => setConfirmacion({ ...confirmacion, cargar: e.target.value })} />
                  <button className="btn btn-primary btn-sm" type="submit" disabled={bloqueado}>Volver a cargar</button>
                </form>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="small text-secondary-flv">En el modo demostración los datos viven en este navegador. Puedes volver a los datos iniciales en cualquier momento.</p>
            <button type="button" className="btn btn-primary btn-sm" disabled={procesando}
              onClick={() => window.confirm('¿Volver a los datos de demostración iniciales? Se perderán los cambios guardados en este navegador.') && ejecutar(restablecer, 'Datos de demostración restablecidos.')}>
              <i className="bi bi-arrow-repeat me-1" aria-hidden="true"></i>Restablecer datos de demostración
            </button>
          </>
        )}
        {estado && <p className={`small mt-3 mb-0 text-${estado.tipo === 'info' ? 'secondary' : estado.tipo}`} role="status">{estado.texto}</p>}
      </section>
    </>
  );
}
