import { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import PageHeader from '../../components/PageHeader.jsx';

const ICONOS_REDES = [
  ['facebook', 'Facebook'], ['twitter-x', 'X'], ['instagram', 'Instagram'], ['youtube', 'YouTube'],
  ['tiktok', 'TikTok'], ['whatsapp', 'WhatsApp'], ['spotify', 'Spotify'], ['globe', 'Sitio web'],
];
const NUEVA_RED = { nombre: '', url: '', icono: 'facebook', activa: true };

// Datos de contacto y redes sociales del pie de página
export default function AdminSitio() {
  const { configuracion, redes, guardarConfiguracion, guardarEntidad, eliminarEntidad, reemplazarColeccion } = useApp();
  const [contacto, setContacto] = useState(configuracion);
  const [red, setRed] = useState(NUEVA_RED);
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
    ejecutar(() => guardarConfiguracion({ ...configuracion, ...contacto, modoBanner: configuracion.modoBanner, diasVisibleCerradas: configuracion.diasVisibleCerradas }), 'Datos del sitio guardados.');
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

  // Campo del formulario con ayuda debajo; `vacioOculta` avisa que dejarlo vacío lo quita del sitio
  const campo = (nombre, etiqueta, { tipo = 'text', ayuda = '', vacioOculta = false, placeholder = '' } = {}) => {
    const idAyuda = `s-${nombre}-ayuda`;
    const textoAyuda = [ayuda, vacioOculta ? 'Déjalo vacío para no mostrarlo.' : ''].filter(Boolean).join(' ');
    const comun = {
      id: `s-${nombre}`, value: contacto[nombre] ?? '', placeholder,
      className: `form-control ${errores[nombre] ? 'is-invalid' : ''}`,
      'aria-describedby': textoAyuda ? idAyuda : undefined,
      onChange: (e) => setContacto({ ...contacto, [nombre]: e.target.value }),
    };
    return (
      <div className="mb-3">
        <label className="form-label" htmlFor={`s-${nombre}`}>{etiqueta}</label>
        {tipo === 'textarea' ? <textarea rows="2" {...comun}></textarea> : <input type={tipo} {...comun} />}
        {errores[nombre] ? <div className="invalid-feedback">{errores[nombre]}</div> : textoAyuda && <div id={idAyuda} className="form-text">{textoAyuda}</div>}
      </div>
    );
  };

  const seccion = (num, id, titulo, descripcion) => (
    <div className="form-seccion mb-3">
      <h3 id={id} className="form-seccion-titulo"><span className="form-seccion-num" aria-hidden="true">{num}</span>{titulo}</h3>
      {descripcion && <p className="small text-secondary-flv mb-0 mt-1">{descripcion}</p>}
    </div>
  );

  const hayCambios = ['nombreOrganizacion', 'telefono', 'direccion', 'correo', 'textoPie', 'avisoSuperior', 'subtituloLogo', 'textoAcerca', 'mostrarEquipo']
    .some((k) => (contacto[k] ?? '') !== (configuracion?.[k] ?? ''));

  return (
    <>
      <PageHeader titulo="Contacto y redes" subtitulo="Lo que el público ve en el encabezado y el pie de página: datos de contacto, textos del proyecto y redes sociales." />
      {mensaje && (
        <div className={`alert alert-${mensaje.tipo} alert-dismissible`} role="status">
          {mensaje.texto}
          <button type="button" className="btn-close" aria-label="Cerrar mensaje" onClick={() => setMensaje(null)}></button>
        </div>
      )}
      <div className="row g-4">
        <div className="col-xl-7">
          <form className="card-flv p-3 p-md-4" noValidate onSubmit={guardarContacto} aria-label="Contacto y textos del sitio">
            <section aria-labelledby="sec-contacto">
              {seccion(1, 'sec-contacto', 'Datos de contacto', 'Aparecen en la columna «Contacto» del pie de página.')}
              <div className="row gx-3">
                <div className="col-12">{campo('nombreOrganizacion', 'Organización')}</div>
                <div className="col-md-6">{campo('telefono', 'Teléfono', { tipo: 'tel', placeholder: '(+57) 300 000 0000' })}</div>
                <div className="col-md-6">{campo('correo', 'Correo electrónico', { tipo: 'email', placeholder: 'contacto@ejemplo.com' })}</div>
                <div className="col-12">{campo('direccion', 'Dirección')}</div>
              </div>
            </section>

            <section aria-labelledby="sec-pie">
              {seccion(2, 'sec-pie', 'Pie de página', 'Textos que acompañan a todas las páginas, de arriba abajo.')}
              {campo('avisoSuperior', 'Franja destacada', { tipo: 'textarea', ayuda: 'Se ve sobre el pie, en dorado sobre fondo oscuro.', vacioOculta: true })}
              {contacto.avisoSuperior?.trim() && (
                <div className="aviso-prototipo text-center py-2 px-3 rounded-2 mb-3" aria-label="Vista previa de la franja">
                  <i className="bi bi-info-circle-fill me-1" aria-hidden="true"></i>{contacto.avisoSuperior}
                </div>
              )}
              {campo('textoPie', 'Descripción bajo «Sistema Web de Votaciones»', { tipo: 'textarea', vacioOculta: true })}
              {campo('textoAcerca', 'Texto «Acerca de»', { ayuda: 'Última línea del pie de página.', vacioOculta: true })}
            </section>

            <section aria-labelledby="sec-encabezado">
              {seccion(3, 'sec-encabezado', 'Encabezado y páginas', 'Cómo se presenta el sitio en el menú superior.')}
              {campo('subtituloLogo', 'Subtítulo del logo', { ayuda: 'Texto pequeño bajo «Votaciones FLV».', vacioOculta: true, placeholder: 'Prototipo académico' })}
              <div className="form-check form-switch mb-3">
                <input className="form-check-input" type="checkbox" role="switch" id="s-mostrarEquipo" checked={contacto.mostrarEquipo ?? true} onChange={(e) => setContacto({ ...contacto, mostrarEquipo: e.target.checked })} aria-describedby="s-equipo-ayuda" />
                <label className="form-check-label fw-semibold" htmlFor="s-mostrarEquipo">Mostrar la página del equipo</label>
                <div id="s-equipo-ayuda" className="form-text">Apagada, se quitan los enlaces «Equipo» del menú y del pie, y /equipo no se muestra.</div>
              </div>
            </section>

            <div className="d-flex flex-wrap align-items-center gap-2 border-top pt-3">
              <button type="submit" className="btn btn-primary" disabled={procesando || !hayCambios}>
                <i className="bi bi-check-lg me-1" aria-hidden="true"></i>{procesando ? 'Guardando…' : 'Guardar cambios'}
              </button>
              {hayCambios ? (
                <>
                  <button type="button" className="btn btn-outline-secondary" onClick={() => setContacto(configuracion)} disabled={procesando}>Descartar</button>
                  <span className="small text-secondary-flv"><i className="bi bi-pencil me-1" aria-hidden="true"></i>Tienes cambios sin guardar.</span>
                </>
              ) : (
                <span className="small text-secondary-flv">Sin cambios pendientes.</span>
              )}
            </div>
          </form>
        </div>
        <div className="col-xl-5">
          <section className="card-flv p-3 p-md-4" aria-labelledby="titulo-redes">
            <h2 id="titulo-redes" className="h5 mb-1">Redes sociales</h2>
            <p className="small text-secondary-flv">Íconos del pie de página. Usa las flechas para ordenarlas; cada cambio se guarda al instante.</p>
            <ul className="list-group list-group-flush mb-3">
              {lista.map((x, i) => (
                <li key={x.id} className="list-group-item px-0 d-flex align-items-center gap-2">
                  <i className={`bi bi-${x.icono} fs-5 text-rojo`} aria-hidden="true"></i>
                  <span className="flex-grow-1" style={{ minWidth: 0 }}>
                    <strong>{x.nombre}</strong>{!x.activa && <span className="badge text-bg-secondary ms-2">Oculta</span>}
                    <span className="d-block small text-secondary-flv text-break">{x.url}</span>
                  </span>
                  <span className="btn-group flex-shrink-0" role="group" aria-label={`Acciones para ${x.nombre}`}>
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
