import { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import { DIAS_VISIBLE_CERRADAS } from '../../utils/visibilidad.js';

const ICONOS_REDES = [
  ['facebook', 'Facebook'], ['twitter-x', 'X'], ['instagram', 'Instagram'], ['youtube', 'YouTube'],
  ['tiktok', 'TikTok'], ['whatsapp', 'WhatsApp'], ['spotify', 'Spotify'], ['globe', 'Sitio web'],
];
const NUEVA_RED = { nombre: '', url: '', icono: 'facebook', activa: true };

// Datos de contacto y redes sociales del pie de página, y visibilidad de las votaciones cerradas
export default function AdminSitio() {
  const { configuracion, redes, guardarConfiguracion, guardarEntidad, eliminarEntidad, reemplazarColeccion } = useApp();
  const [contacto, setContacto] = useState(configuracion);
  const [red, setRed] = useState(NUEVA_RED);
  const [dias, setDias] = useState(String(configuracion?.diasVisibleCerradas ?? DIAS_VISIBLE_CERRADAS));
  const [errores, setErrores] = useState({});
  const [mensaje, setMensaje] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const lista = [...redes].sort((a, b) => a.orden - b.orden || a.id - b.id);

  const ejecutar = async (accion, exito) => {
    setProcesando(true);
    const r = await accion();
    setProcesando(false);
    setMensaje(r.ok ? { tipo: 'success', texto: exito } : { tipo: 'danger', texto: r.error });
    setErrores(r.ok ? {} : r.errores || {});
    return r;
  };

  const guardarContacto = (e) => {
    e.preventDefault();
    // Se parte de la configuración vigente para no pisar el modo del banner ni los días de visibilidad
    ejecutar(() => guardarConfiguracion({ ...configuracion, ...contacto, modoBanner: configuracion.modoBanner, diasVisibleCerradas: configuracion.diasVisibleCerradas }), 'Datos de contacto guardados.');
  };

  const guardarDias = (e) => {
    e.preventDefault();
    const n = Number(dias);
    if (!/^\d+$/.test(dias) || n > 365) {
      setErrores({ diasVisibleCerradas: 'Escribe un número de días entre 0 y 365.' });
      return;
    }
    ejecutar(
      () => guardarConfiguracion({ ...configuracion, diasVisibleCerradas: n }),
      n === 0 ? 'Las votaciones cerradas se ocultan del sitio al cerrar.' : `Las votaciones cerradas se verán ${n} ${n === 1 ? 'día' : 'días'} después del cierre.`,
    );
  };

  const guardarRed = async (e) => {
    e.preventDefault();
    if (!red.nombre.trim() || !/^https?:\/\/\S+$/.test(red.url.trim())) {
      setErrores({ url: 'Escribe el nombre y una URL que empiece por http:// o https://.' });
      return;
    }
    const datos = { ...red, url: red.url.trim(), orden: red.orden ?? lista.length + 1 };
    const r = await ejecutar(() => guardarEntidad('redes', datos, `${red.id ? 'Actualizó' : 'Agregó'} la red "${red.nombre}"`), `Red «${red.nombre}» guardada.`);
    if (r.ok) setRed(NUEVA_RED);
  };

  const mover = (i, delta) => {
    const nueva = [...lista];
    [nueva[i], nueva[i + delta]] = [nueva[i + delta], nueva[i]];
    ejecutar(() => reemplazarColeccion('redes', nueva.map((x, j) => ({ ...x, orden: j + 1 })), 'Reordenó las redes sociales'), 'Orden actualizado.');
  };

  const campo = (nombre, etiqueta, tipo = 'text') => (
    <div className="mb-3">
      <label className="form-label" htmlFor={`s-${nombre}`}>{etiqueta}</label>
      {tipo === 'textarea' ? (
        <textarea id={`s-${nombre}`} rows="2" className="form-control" value={contacto[nombre]} onChange={(e) => setContacto({ ...contacto, [nombre]: e.target.value })}></textarea>
      ) : (
        <input id={`s-${nombre}`} type={tipo} className={`form-control ${errores[nombre] ? 'is-invalid' : ''}`} value={contacto[nombre]} onChange={(e) => setContacto({ ...contacto, [nombre]: e.target.value })} />
      )}
      {errores[nombre] && <div className="invalid-feedback">{errores[nombre]}</div>}
    </div>
  );

  return (
    <>
      <PageHeader titulo="Contacto y redes" subtitulo="Información del pie de página y visibilidad de las votaciones cerradas en el sitio." />
      {mensaje && (
        <div className={`alert alert-${mensaje.tipo} alert-dismissible`} role="status">
          {mensaje.texto}
          <button type="button" className="btn-close" aria-label="Cerrar mensaje" onClick={() => setMensaje(null)}></button>
        </div>
      )}
      <div className="row g-4">
        <div className="col-xl-5">
          <form className="card-flv p-3 p-md-4" noValidate onSubmit={guardarContacto} aria-labelledby="titulo-contacto">
            <h2 id="titulo-contacto" className="h5">Datos de contacto</h2>
            {campo('nombreOrganizacion', 'Organización')}
            {campo('telefono', 'Teléfono', 'tel')}
            {campo('direccion', 'Dirección')}
            {campo('correo', 'Correo electrónico', 'email')}
            {campo('textoPie', 'Texto del pie de página', 'textarea')}
            <button type="submit" className="btn btn-primary" disabled={procesando}>Guardar contacto</button>
          </form>
          <form className="card-flv p-3 p-md-4 mt-4" noValidate onSubmit={guardarDias} aria-labelledby="titulo-cerradas">
            <h2 id="titulo-cerradas" className="h5">Votaciones cerradas</h2>
            <p className="small text-secondary-flv">
              El sitio público muestra las votaciones programadas y abiertas. Las cerradas siguen visibles estos días después de su cierre; con 0 se ocultan al cerrar.
              Las categorías de ediciones cerradas no se muestran.
            </p>
            <label className="form-label" htmlFor="s-dias">Días visibles después del cierre</label>
            <div className="input-group mb-3" style={{ maxWidth: '16rem' }}>
              <input id="s-dias" type="number" min="0" max="365" className={`form-control ${errores.diasVisibleCerradas ? 'is-invalid' : ''}`} value={dias} onChange={(e) => setDias(e.target.value)} aria-describedby="s-dias-error" />
              <span className="input-group-text">días</span>
              {errores.diasVisibleCerradas && <div id="s-dias-error" className="invalid-feedback">{errores.diasVisibleCerradas}</div>}
            </div>
            <button type="submit" className="btn btn-primary" disabled={procesando}>Guardar</button>
          </form>
        </div>
        <div className="col-xl-7">
          <section className="card-flv p-3 p-md-4" aria-labelledby="titulo-redes">
            <h2 id="titulo-redes" className="h5">Redes sociales</h2>
            <ul className="list-group list-group-flush mb-3">
              {lista.map((x, i) => (
                <li key={x.id} className="list-group-item px-0 d-flex flex-wrap align-items-center gap-2">
                  <i className={`bi bi-${x.icono} fs-5 text-rojo`} aria-hidden="true"></i>
                  <span className="flex-grow-1">
                    <strong>{x.nombre}</strong>{!x.activa && <span className="badge text-bg-secondary ms-2">Oculta</span>}
                    <span className="d-block small text-secondary-flv text-break">{x.url}</span>
                  </span>
                  <span className="btn-group" role="group" aria-label={`Acciones para ${x.nombre}`}>
                    <button className="btn btn-sm btn-outline-secondary" disabled={i === 0 || procesando} onClick={() => mover(i, -1)} aria-label={`Subir ${x.nombre}`}><i className="bi bi-arrow-up" aria-hidden="true"></i></button>
                    <button className="btn btn-sm btn-outline-secondary" disabled={i === lista.length - 1 || procesando} onClick={() => mover(i, 1)} aria-label={`Bajar ${x.nombre}`}><i className="bi bi-arrow-down" aria-hidden="true"></i></button>
                    <button className="btn btn-sm btn-outline-primary" onClick={() => setRed(x)} aria-label={`Editar ${x.nombre}`}><i className="bi bi-pencil" aria-hidden="true"></i></button>
                    <button className="btn btn-sm btn-outline-danger" disabled={procesando} aria-label={`Quitar ${x.nombre}`}
                      onClick={() => ejecutar(() => eliminarEntidad('redes', x.id, `Quitó la red "${x.nombre}"`), `Red «${x.nombre}» quitada.`)}>
                      <i className="bi bi-trash" aria-hidden="true"></i>
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <form noValidate onSubmit={guardarRed} aria-label={red.id ? `Editar ${red.nombre}` : 'Agregar red social'}>
              <div className="row g-2 align-items-end">
                <div className="col-sm-4">
                  <label className="form-label small" htmlFor="r-icono">Red</label>
                  <select id="r-icono" className="form-select" value={red.icono}
                    onChange={(e) => setRed({ ...red, icono: e.target.value, nombre: red.nombre || ICONOS_REDES.find(([k]) => k === e.target.value)[1] })}>
                    {ICONOS_REDES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}
                  </select>
                </div>
                <div className="col-sm-3">
                  <label className="form-label small" htmlFor="r-nombre">Nombre</label>
                  <input id="r-nombre" className="form-control" value={red.nombre} onChange={(e) => setRed({ ...red, nombre: e.target.value })} />
                </div>
                <div className="col-sm-5">
                  <label className="form-label small" htmlFor="r-url">URL</label>
                  <input id="r-url" type="url" placeholder="https://" className={`form-control ${errores.url ? 'is-invalid' : ''}`} value={red.url} onChange={(e) => setRed({ ...red, url: e.target.value })} />
                </div>
                {errores.url && <div className="col-12 small text-danger" role="alert">{errores.url}</div>}
                <div className="col-12 d-flex flex-wrap gap-3 align-items-center">
                  <div className="form-check form-switch mb-0">
                    <input id="r-activa" className="form-check-input" type="checkbox" role="switch" checked={red.activa} onChange={(e) => setRed({ ...red, activa: e.target.checked })} />
                    <label className="form-check-label small" htmlFor="r-activa">Visible en el pie de página</label>
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm ms-auto" disabled={procesando}>{red.id ? 'Guardar cambios' : 'Agregar red'}</button>
                  {red.id && <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setRed(NUEVA_RED)}>Cancelar</button>}
                </div>
              </div>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
