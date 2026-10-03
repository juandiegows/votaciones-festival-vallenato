import { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Modal from '../../components/Modal.jsx';
import { validarEnlaceMultimedia } from '../../utils/helpers.js';

const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
const MAXIMO = 3 * 1024 * 1024;

// Banners del inicio: imagen (JPG, PNG o WebP, máx. 3 MB), textos, botón, orden y estado
export default function AdminBanner() {
  const { banners, guardarEntidad, eliminarEntidad, reemplazarColeccion } = useApp();
  const [form, setForm] = useState(null);
  const [errores, setErrores] = useState({});
  const [mensaje, setMensaje] = useState(null);
  const [aEliminar, setAEliminar] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [vistaPrevia, setVistaPrevia] = useState('');
  const lista = [...banners].sort((a, b) => a.orden - b.orden || a.id - b.id);

  useEffect(() => () => vistaPrevia.startsWith('blob:') && URL.revokeObjectURL(vistaPrevia), [vistaPrevia]);

  const abrir = (b) => {
    setErrores({});
    setVistaPrevia(b.imagen || '');
    setForm({ titulo: '', subtitulo: '', textoAlternativo: '', textoBoton: '', enlaceBoton: '', activo: true, orden: lista.length + 1, ...b, archivo: null });
  };

  const elegirArchivo = (e) => {
    const archivo = e.target.files[0] || null;
    setForm({ ...form, archivo });
    setVistaPrevia(archivo ? URL.createObjectURL(archivo) : form.imagen || '');
  };

  const ejecutar = async (accion, exito) => {
    setProcesando(true);
    const r = await accion();
    setProcesando(false);
    setMensaje(r.ok ? { tipo: 'success', texto: exito } : { tipo: 'danger', texto: r.error });
    return r;
  };

  const guardar = async (e) => {
    e.preventDefault();
    const errs = {};
    if (form.titulo.trim().length < 3) errs.titulo = 'Escribe un título de al menos 3 caracteres.';
    if (!form.textoAlternativo.trim()) errs.textoAlternativo = 'Describe la imagen para quienes usan lectores de pantalla.';
    if (!form.id && !form.archivo) errs.archivo = 'Selecciona una imagen.';
    if (form.archivo && !TIPOS.includes(form.archivo.type)) errs.archivo = 'Formato no permitido: usa una imagen JPG, PNG o WebP.';
    else if (form.archivo && form.archivo.size > MAXIMO) errs.archivo = 'La imagen supera el tamaño máximo de 3 MB.';
    if (!validarEnlaceMultimedia(form.enlaceBoton.trim())) errs.enlaceBoton = 'Usa una ruta del sitio (/2027) o una URL http(s).';
    setErrores(errs);
    if (Object.keys(errs).length) return;
    const datos = { ...form, enlaceBoton: form.enlaceBoton.trim(), orden: Number(form.orden) };
    if (!datos.archivo) delete datos.archivo;
    const r = await ejecutar(() => guardarEntidad('banners', datos, `${form.id ? 'Actualizó' : 'Creó'} el banner "${form.titulo}"`), `Banner «${form.titulo}» guardado.`);
    if (r.ok) setForm(null);
    else setErrores(r.errores || {});
  };

  const mover = (i, delta) => {
    const nueva = [...lista];
    [nueva[i], nueva[i + delta]] = [nueva[i + delta], nueva[i]];
    ejecutar(() => reemplazarColeccion('banners', nueva.map((b, j) => ({ ...b, orden: j + 1 })), 'Reordenó los banners'), 'Orden actualizado.');
  };

  return (
    <>
      <PageHeader titulo="Banner de inicio" subtitulo="Imágenes y mensajes del carrusel de la página principal. Sin banners activos se muestra el inicio ilustrado.">
        <button className="btn btn-primary" onClick={() => abrir({})}><i className="bi bi-plus-lg me-1" aria-hidden="true"></i>Nuevo banner</button>
      </PageHeader>
      {mensaje && (
        <div className={`alert alert-${mensaje.tipo} alert-dismissible`} role="status">
          {mensaje.texto}
          <button type="button" className="btn-close" aria-label="Cerrar mensaje" onClick={() => setMensaje(null)}></button>
        </div>
      )}
      <div className="table-responsive card-flv">
        <table className="table table-flv align-middle mb-0">
          <caption className="visually-hidden">Banners del inicio</caption>
          <thead>
            <tr><th scope="col">Imagen</th><th scope="col">Texto</th><th scope="col">Estado</th><th scope="col" className="text-end">Acciones</th></tr>
          </thead>
          <tbody>
            {lista.map((b, i) => (
              <tr key={b.id}>
                <td><img src={b.imagen} alt={b.textoAlternativo} className="banner-miniatura" /></td>
                <td>
                  <strong>{b.titulo}</strong>
                  <div className="small text-secondary-flv">{b.subtitulo}</div>
                  {b.enlaceBoton && <div className="small"><code>{b.enlaceBoton}</code></div>}
                </td>
                <td>
                  <div className="form-check form-switch mb-0">
                    <input className="form-check-input" type="checkbox" role="switch" id={`banner-${b.id}`} checked={b.activo} disabled={procesando}
                      onChange={() => ejecutar(() => guardarEntidad('banners', { id: b.id, activo: !b.activo }, `${b.activo ? 'Desactivó' : 'Activó'} el banner "${b.titulo}"`), `Banner «${b.titulo}» ${b.activo ? 'desactivado' : 'activado'}.`)} />
                    <label className="form-check-label small" htmlFor={`banner-${b.id}`}>{b.activo ? 'Activo' : 'Inactivo'}</label>
                  </div>
                </td>
                <td className="text-end text-nowrap">
                  <button className="btn btn-sm btn-outline-secondary me-1" disabled={i === 0 || procesando} onClick={() => mover(i, -1)} aria-label={`Subir ${b.titulo}`}><i className="bi bi-arrow-up" aria-hidden="true"></i></button>
                  <button className="btn btn-sm btn-outline-secondary me-1" disabled={i === lista.length - 1 || procesando} onClick={() => mover(i, 1)} aria-label={`Bajar ${b.titulo}`}><i className="bi bi-arrow-down" aria-hidden="true"></i></button>
                  <button className="btn btn-sm btn-outline-primary me-1" onClick={() => abrir(b)} aria-label={`Editar ${b.titulo}`}><i className="bi bi-pencil" aria-hidden="true"></i></button>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => setAEliminar(b)} aria-label={`Eliminar ${b.titulo}`}><i className="bi bi-trash" aria-hidden="true"></i></button>
                </td>
              </tr>
            ))}
            {lista.length === 0 && <tr><td colSpan="4" className="text-center py-4">No hay banners: el inicio muestra la ilustración predeterminada.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal
        abierto={!!form}
        tamano="modal-lg"
        titulo={form?.id ? 'Editar banner' : 'Nuevo banner'}
        onCerrar={() => setForm(null)}
        pie={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setForm(null)}>Cancelar</button>
            <button className="btn btn-primary" type="submit" form="form-banner" disabled={procesando}>{procesando ? 'Guardando…' : 'Guardar'}</button>
          </>
        }
      >
        {form && (
          <form id="form-banner" noValidate onSubmit={guardar}>
            <div className="mb-3">
              <label className="form-label" htmlFor="b-imagen">Imagen <span className="fw-normal text-secondary-flv">(JPG, PNG o WebP, máximo 3 MB; recomendado 1600 × 600 px)</span></label>
              <input id="b-imagen" type="file" accept="image/jpeg,image/png,image/webp" className={`form-control ${errores.archivo || errores.imagen ? 'is-invalid' : ''}`} onChange={elegirArchivo} />
              {(errores.archivo || errores.imagen) && <div className="invalid-feedback">{errores.archivo || errores.imagen}</div>}
              {vistaPrevia && <img src={vistaPrevia} alt="Vista previa del banner" className="banner-vista-previa mt-2" />}
            </div>
            {[
              ['titulo', 'Título', 'b-titulo'],
              ['subtitulo', 'Subtítulo (opcional)', 'b-subtitulo'],
              ['textoAlternativo', 'Texto alternativo de la imagen', 'b-alt'],
              ['textoBoton', 'Texto del botón (opcional)', 'b-boton'],
              ['enlaceBoton', 'Enlace del botón: ruta del sitio (/2027) o URL', 'b-enlace'],
            ].map(([campo, etiqueta, id]) => (
              <div className="mb-3" key={campo}>
                <label className="form-label" htmlFor={id}>{etiqueta}</label>
                <input id={id} className={`form-control ${errores[campo] ? 'is-invalid' : ''}`} value={form[campo]} onChange={(e) => setForm({ ...form, [campo]: e.target.value })} />
                {errores[campo] && <div className="invalid-feedback">{errores[campo]}</div>}
              </div>
            ))}
            <div className="form-check form-switch">
              <input id="b-activo" className="form-check-input" type="checkbox" role="switch" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
              <label className="form-check-label" htmlFor="b-activo">Mostrar en el inicio</label>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        abierto={!!aEliminar}
        titulo="Eliminar banner"
        onCerrar={() => setAEliminar(null)}
        pie={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setAEliminar(null)}>Cancelar</button>
            <button className="btn btn-peligro" disabled={procesando} onClick={async () => {
              await ejecutar(() => eliminarEntidad('banners', aEliminar.id, `Eliminó el banner "${aEliminar.titulo}"`), `Banner «${aEliminar.titulo}» eliminado.`);
              setAEliminar(null);
            }}>Eliminar</button>
          </>
        }
      >
        <p className="mb-0">¿Eliminar el banner «{aEliminar?.titulo}» y su imagen?</p>
      </Modal>
    </>
  );
}
