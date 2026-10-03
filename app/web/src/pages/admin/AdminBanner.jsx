import { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { useEdicionAdmin } from '../../context/EdicionAdmin.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Modal from '../../components/Modal.jsx';
import { validarEnlaceMultimedia } from '../../utils/helpers.js';
import TablaResponsiva from '../../components/TablaResponsiva.jsx';

const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
const MAXIMO = 3 * 1024 * 1024;
// Los banners sin título se identifican por su texto alternativo
const nombreBanner = (b) => b.titulo || b.textoAlternativo;
const MODOS = [
  ['fijo', 'Banner fijo', 'Solo se muestra el primer banner activo de la lista.'],
  ['carrusel', 'Carrusel', 'Los banners activos rotan cada 7 segundos.'],
];

// Banners del inicio: imagen (JPG, PNG o WebP, máx. 3 MB), textos, botón, orden y estado
export default function AdminBanner() {
  const { banners, configuracion, guardarConfiguracion, guardarEntidad, eliminarEntidad, reemplazarColeccion } = useApp();
  const modo = configuracion?.modoBanner || 'carrusel';
  const [form, setForm] = useState(null);
  const [errores, setErrores] = useState({});
  const [mensaje, setMensaje] = useState(null);
  const [aEliminar, setAEliminar] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [vistaPrevia, setVistaPrevia] = useState('');
  const { edicion, edicionId, esActiva } = useEdicionAdmin();
  // Cada edición tiene sus propios banners (los antiguos sin edición se muestran con la activa)
  const lista = banners.filter((b) => (b.edicionId ?? (esActiva ? edicionId : null)) === edicionId).sort((a, b) => a.orden - b.orden || a.id - b.id);

  useEffect(() => () => vistaPrevia.startsWith('blob:') && URL.revokeObjectURL(vistaPrevia), [vistaPrevia]);

  const abrir = (b) => {
    setErrores({});
    setVistaPrevia(b.imagen || '');
    setForm({ titulo: '', subtitulo: '', textoAlternativo: '', textoBoton: '', enlaceBoton: '', activo: true, orden: lista.length + 1, edicionId, ...b, archivo: null });
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
    if (form.titulo.trim() && form.titulo.trim().length < 3) errs.titulo = 'Escribe un título de al menos 3 caracteres o déjalo vacío.';
    if (!form.textoAlternativo.trim()) errs.textoAlternativo = 'Describe la imagen para quienes usan lectores de pantalla.';
    if (!form.id && !form.archivo) errs.archivo = 'Selecciona una imagen.';
    if (form.archivo && !TIPOS.includes(form.archivo.type)) errs.archivo = 'Formato no permitido: usa una imagen JPG, PNG o WebP.';
    else if (form.archivo && form.archivo.size > MAXIMO) errs.archivo = 'La imagen supera el tamaño máximo de 3 MB.';
    if (!validarEnlaceMultimedia(form.enlaceBoton.trim())) errs.enlaceBoton = 'Usa una ruta del sitio (/2027) o una URL http(s).';
    setErrores(errs);
    if (Object.keys(errs).length) return;
    const datos = { ...form, enlaceBoton: form.enlaceBoton.trim(), orden: Number(form.orden) };
    if (!datos.archivo) delete datos.archivo;
    const nombre = form.titulo.trim() || form.textoAlternativo.trim();
    const r = await ejecutar(() => guardarEntidad('banners', datos, `${form.id ? 'Actualizó' : 'Creó'} el banner "${nombre}"`), `Banner «${nombre}» guardado.`);
    if (r.ok) setForm(null);
    else setErrores(r.errores || {});
  };

  const mover = (i, delta) => {
    const nueva = [...lista];
    [nueva[i], nueva[i + delta]] = [nueva[i + delta], nueva[i]];
    const ordenes = new Map(nueva.map((b, j) => [b.id, j + 1]));
    const todos = banners.map((b) => (ordenes.has(b.id) ? { ...b, orden: ordenes.get(b.id) } : b));
    ejecutar(() => reemplazarColeccion('banners', todos, 'Reordenó los banners'), 'Orden actualizado.');
  };

  const cambiarModo = (nuevo) => {
    if (nuevo === modo) return;
    const etiqueta = MODOS.find(([k]) => k === nuevo)[1];
    ejecutar(() => guardarConfiguracion({ ...configuracion, modoBanner: nuevo }), `El inicio ahora muestra: ${etiqueta.toLowerCase()}.`);
  };

  return (
    <>
      <PageHeader titulo="Banner de inicio" subtitulo={`${edicion ? `${edicion.nombre} · ` : ''}Imágenes de la cabecera de la página principal. Se muestran los banners de la edición activa; sin banners activos se muestra el inicio ilustrado.`}>
        <button className="btn btn-primary" onClick={() => abrir({})}><i className="bi bi-plus-lg me-1" aria-hidden="true"></i>Nuevo banner</button>
      </PageHeader>
      {mensaje && (
        <div className={`alert alert-${mensaje.tipo} alert-dismissible`} role="status">
          {mensaje.texto}
          <button type="button" className="btn-close" aria-label="Cerrar mensaje" onClick={() => setMensaje(null)}></button>
        </div>
      )}
      <fieldset className="card-flv p-3 mb-3" disabled={procesando}>
        <legend className="h6 float-none w-auto mb-2">¿Cómo se muestra el banner en el inicio?</legend>
        <div className="d-flex flex-wrap gap-4">
          {MODOS.map(([valor, etiqueta, ayuda]) => (
            <div className="form-check" key={valor}>
              <input className="form-check-input" type="radio" name="modo-banner" id={`modo-${valor}`} checked={modo === valor} onChange={() => cambiarModo(valor)} aria-describedby={`modo-${valor}-ayuda`} />
              <label className="form-check-label fw-semibold" htmlFor={`modo-${valor}`}>{etiqueta}</label>
              <div id={`modo-${valor}-ayuda`} className="small text-secondary-flv">{ayuda}</div>
            </div>
          ))}
        </div>
      </fieldset>
      <TablaResponsiva
        titulo="Banners del inicio"
        filas={lista}
        clave={(b) => b.id}
        nombreFila={nombreBanner}
        vacio="No hay banners: el inicio muestra la ilustración predeterminada."
        columnas={[
          { id: 'imagen', titulo: 'Imagen', prioridad: 3, celda: (b) => <img src={b.imagen} alt={b.textoAlternativo} className="banner-miniatura" /> },
          {
            id: 'texto', titulo: 'Texto', minimo: '10rem', prioridad: 0,
            celda: (b) => (
              <>
                {modo === 'fijo' && b.activo && b.id === lista.find((x) => x.activo)?.id && <span className="badge text-bg-dark me-2">En el inicio</span>}
                <strong>{b.titulo || <span className="fw-normal fst-italic">Solo imagen</span>}</strong>
                <div className="small text-secondary-flv">{b.subtitulo}</div>
                {b.enlaceBoton && <div className="small"><code>{b.enlaceBoton}</code></div>}
              </>
            ),
          },
          {
            id: 'estado', titulo: 'Estado', prioridad: 2,
            celda: (b) => (
              <div className="form-check form-switch mb-0">
                <input className="form-check-input" type="checkbox" role="switch" id={`banner-${b.id}`} checked={b.activo} disabled={procesando}
                  onChange={() => ejecutar(() => guardarEntidad('banners', { id: b.id, activo: !b.activo }, `${b.activo ? 'Desactivó' : 'Activó'} el banner "${nombreBanner(b)}"`), `Banner «${nombreBanner(b)}» ${b.activo ? 'desactivado' : 'activado'}.`)} />
                <label className="form-check-label small" htmlFor={`banner-${b.id}`}>{b.activo ? 'Activo' : 'Inactivo'}</label>
              </div>
            ),
          },
          {
            id: 'acciones', titulo: 'Acciones', claseTh: 'text-end', claseTd: 'text-end text-nowrap', prioridad: 1,
            celda: (b, i) => (
              <>
                <button className="btn btn-sm btn-outline-secondary me-1" disabled={i === 0 || procesando} onClick={() => mover(i, -1)} aria-label={`Subir ${nombreBanner(b)}`}><i className="bi bi-arrow-up" aria-hidden="true"></i></button>
                <button className="btn btn-sm btn-outline-secondary me-1" disabled={i === lista.length - 1 || procesando} onClick={() => mover(i, 1)} aria-label={`Bajar ${nombreBanner(b)}`}><i className="bi bi-arrow-down" aria-hidden="true"></i></button>
                <button className="btn btn-sm btn-outline-primary me-1" onClick={() => abrir(b)} aria-label={`Editar ${nombreBanner(b)}`}><i className="bi bi-pencil" aria-hidden="true"></i></button>
                <button className="btn btn-sm btn-outline-danger" onClick={() => setAEliminar(b)} aria-label={`Eliminar ${nombreBanner(b)}`}><i className="bi bi-trash" aria-hidden="true"></i></button>
              </>
            ),
          },
        ]}
      />

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
              <label className="form-label" htmlFor="b-imagen">Imagen <span className="fw-normal text-secondary-flv">(JPG, PNG o WebP, máximo 3 MB; recomendado 1920 × 600 px)</span></label>
              <input id="b-imagen" type="file" accept="image/jpeg,image/png,image/webp" className={`form-control ${errores.archivo || errores.imagen ? 'is-invalid' : ''}`} onChange={elegirArchivo} />
              {(errores.archivo || errores.imagen) && <div className="invalid-feedback">{errores.archivo || errores.imagen}</div>}
              {vistaPrevia && <img src={vistaPrevia} alt="Vista previa del banner" className="banner-vista-previa mt-2" />}
            </div>
            {[
              ['titulo', 'Título (opcional: déjalo vacío si la imagen ya trae el texto)', 'b-titulo'],
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
              await ejecutar(() => eliminarEntidad('banners', aEliminar.id, `Eliminó el banner "${nombreBanner(aEliminar)}"`), `Banner «${nombreBanner(aEliminar)}» eliminado.`);
              setAEliminar(null);
            }}>Eliminar</button>
          </>
        }
      >
        <p className="mb-0">¿Eliminar el banner «{aEliminar && nombreBanner(aEliminar)}» y su imagen?</p>
      </Modal>
    </>
  );
}
