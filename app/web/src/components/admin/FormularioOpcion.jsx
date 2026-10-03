import { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { MODO_API } from '../../config.js';
import Modal from '../Modal.jsx';
import ReproductorMultimedia, { fuenteMedio } from '../ReproductorMultimedia.jsx';
import { validarEnlaceMultimedia } from '../../utils/helpers.js';

const EXTENSIONES_AUDIO = /\.(mp3|ogg|wav|m4a|webm)$/i;
// En el modo demostración el audio se guarda en el navegador (localStorage), que tiene poco espacio
const TAMANO_MAXIMO = MODO_API ? 10 * 1024 * 1024 : 2 * 1024 * 1024;
const TEXTO_MAXIMO = MODO_API ? '10 MB' : '2 MB';

/** Valores iniciales para una opción nueva de `votacion`. */
export function opcionNueva(votacion, orden) {
  return { votacionId: votacion.id, nombre: '', descripcion: '', enlaceMultimedia: '', audio: '', textoAudio: '', orden, activa: true };
}

/**
 * Modal para agregar o editar una opción: nombre, descripción, audio subido desde el equipo
 * (con su texto) o, en segundo lugar, un enlace multimedia. Se usa en «Votaciones» y en «Opciones».
 */
export default function FormularioOpcion({ opcion, votacion, onCerrar, onGuardada }) {
  const { guardarEntidad } = useApp();
  const [form, setForm] = useState(null);
  const [errores, setErrores] = useState({});
  const [mensaje, setMensaje] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [vistaPrevia, setVistaPrevia] = useState('');

  useEffect(() => {
    setErrores({});
    setMensaje('');
    setForm(opcion ? { ...opcion, enlaceMultimedia: opcion.enlaceMultimedia || '', audio: opcion.audio || '', textoAudio: opcion.textoAudio || '', archivoAudio: null, quitarAudio: false } : null);
  }, [opcion]);

  useEffect(() => {
    if (!form?.archivoAudio) {
      setVistaPrevia('');
      return undefined;
    }
    const url = URL.createObjectURL(form.archivoAudio);
    setVistaPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [form?.archivoAudio]);

  const cambiar = (parcial) => setForm((f) => ({ ...f, ...parcial }));

  const elegirArchivo = (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    if (!archivo.type.startsWith('audio/') && !EXTENSIONES_AUDIO.test(archivo.name)) {
      setErrores((x) => ({ ...x, audio: 'Formato no permitido: usa un archivo MP3, OGG, WAV, M4A o WebM.' }));
      return;
    }
    if (archivo.size > TAMANO_MAXIMO) {
      setErrores((x) => ({
        ...x,
        audio: `El archivo supera ${TEXTO_MAXIMO}.${MODO_API ? '' : ' En el modo demostración el audio se guarda en este navegador; usa un fragmento corto.'}`,
      }));
      return;
    }
    setErrores((x) => ({ ...x, audio: undefined }));
    cambiar({ archivoAudio: archivo, quitarAudio: false });
  };

  const quitarAudio = () => cambiar({ archivoAudio: null, quitarAudio: Boolean(form.audio) });

  const guardar = async (e) => {
    e.preventDefault();
    if (procesando) return;
    const errs = {};
    if (form.nombre.trim().length < 3) errs.nombre = 'El nombre debe tener al menos 3 caracteres.';
    if (!validarEnlaceMultimedia(form.enlaceMultimedia.trim())) {
      errs.enlaceMultimedia = 'Ingresa una URL que empiece por http:// o https://, una ruta del sitio que empiece por «/», o déjalo vacío.';
    }
    setErrores(errs);
    if (Object.keys(errs).length) return;
    // eslint-disable-next-line no-unused-vars
    const { archivoAudio, quitarAudio: quitar, audio, ...resto } = form;
    const datos = { ...resto, nombre: form.nombre.trim(), enlaceMultimedia: form.enlaceMultimedia.trim(), textoAudio: form.textoAudio.trim() };
    if (archivoAudio) datos.archivoAudio = archivoAudio;
    if (quitar && !archivoAudio) datos.quitarAudio = true;
    setProcesando(true);
    const r = await guardarEntidad('opciones', datos, `${form.id ? 'Actualizó' : 'Agregó'} la opción "${datos.nombre}" en "${votacion.titulo}"`);
    setProcesando(false);
    if (!r.ok) {
      setErrores(r.errores || {});
      setMensaje(r.error);
      return;
    }
    onGuardada?.(`Opción «${datos.nombre}» ${form.id ? 'actualizada' : 'agregada'} en «${votacion.titulo}».`);
    onCerrar();
  };

  const audioActual = vistaPrevia || (!form?.quitarAudio && form?.audio) || '';
  const enlace = form?.enlaceMultimedia.trim() || '';
  const enlaceValido = enlace && validarEnlaceMultimedia(enlace);
  const fuente = form && fuenteMedio({ audio: audioActual, enlace: enlaceValido ? enlace : '' });

  return (
    <Modal
      abierto={!!form}
      tamano="modal-lg"
      titulo={form?.id ? 'Editar opción' : `Agregar opción · ${votacion?.titulo || ''}`}
      onCerrar={onCerrar}
      pie={
        <>
          <button className="btn btn-outline-secondary" onClick={onCerrar}>Cancelar</button>
          <button className="btn btn-primary" type="submit" form="form-opcion" disabled={procesando}>{procesando ? 'Guardando…' : 'Guardar'}</button>
        </>
      }
    >
      {form && (
        <form id="form-opcion" noValidate onSubmit={guardar}>
          {mensaje && <div className="alert alert-danger py-2" role="alert">{mensaje}</div>}
          <div className="mb-3">
            <label className="form-label" htmlFor="o-nombre">Nombre</label>
            <input id="o-nombre" className={`form-control ${errores.nombre ? 'is-invalid' : ''}`} value={form.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} />
            {errores.nombre && <div className="invalid-feedback">{errores.nombre}</div>}
          </div>
          <div className="mb-3">
            <label className="form-label" htmlFor="o-desc">Descripción</label>
            <textarea id="o-desc" rows="2" className="form-control" value={form.descripcion} onChange={(e) => cambiar({ descripcion: e.target.value })}></textarea>
          </div>

          <fieldset className="border rounded-3 p-3 mb-3">
            <legend className="float-none w-auto px-2 fs-6 fw-semibold mb-0">
              <i className="bi bi-music-note-beamed me-1" aria-hidden="true"></i>Audio para escuchar la opción <span className="fw-normal text-secondary-flv">(opcional)</span>
            </legend>

            <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
              <label className="btn btn-outline-primary btn-sm mb-0" htmlFor="o-archivo">
                <i className="bi bi-upload me-1" aria-hidden="true"></i>{audioActual ? 'Reemplazar archivo' : 'Subir audio desde tu equipo'}
              </label>
              <input id="o-archivo" type="file" accept="audio/*,.mp3,.ogg,.wav,.m4a,.webm" className="visually-hidden" onChange={elegirArchivo} aria-describedby="o-archivo-ayuda" />
              {audioActual && (
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={quitarAudio}>
                  <i className="bi bi-x-lg me-1" aria-hidden="true"></i>Quitar audio
                </button>
              )}
            </div>
            <div id="o-archivo-ayuda" className="form-text mt-0 mb-2">MP3, OGG, WAV, M4A o WebM de hasta {TEXTO_MAXIMO}.</div>
            {errores.audio && <div className="invalid-feedback d-block mb-2" role="alert">{errores.audio}</div>}

            {audioActual && (
              <div className="fuente-audio mb-2">
                <p className="small fw-semibold mb-1">
                  <i className="bi bi-file-earmark-music me-1" aria-hidden="true"></i>
                  {form.archivoAudio ? `Archivo por subir: ${form.archivoAudio.name}` : 'Archivo de audio subido'}
                </p>
                <ReproductorMultimedia audio={audioActual} titulo={form.nombre || 'opción'} />
              </div>
            )}

            <div className="mb-3">
              <label className="form-label small mb-1" htmlFor="o-enlace">
                {audioActual ? 'Enlace alternativo' : 'O pega un enlace'} <span className="fw-normal text-secondary-flv">(YouTube, Spotify, SoundCloud o .mp3)</span>
              </label>
              <input id="o-enlace" type="text" inputMode="url" placeholder="https://… o /audio/muestras/archivo.mp3" className={`form-control form-control-sm ${errores.enlaceMultimedia ? 'is-invalid' : ''}`} value={form.enlaceMultimedia} onChange={(e) => cambiar({ enlaceMultimedia: e.target.value })} aria-describedby="o-enlace-ayuda" />
              {errores.enlaceMultimedia ? (
                <div className="invalid-feedback">{errores.enlaceMultimedia}</div>
              ) : (
                <div id="o-enlace-ayuda" className="form-text">
                  {audioActual ? 'Si hay un archivo subido, el público escucha el archivo.' : 'Las rutas del sitio empiezan por «/».'}
                </div>
              )}
              {!audioActual && enlaceValido && <ReproductorMultimedia enlace={enlace} titulo={form.nombre || 'opción'} className="mt-2" />}
            </div>

            <div className="mb-2">
              <label className="form-label small mb-1" htmlFor="o-texto-audio">Texto del audio <span className="fw-normal text-secondary-flv">(letra o descripción para quien no puede escuchar)</span></label>
              <textarea id="o-texto-audio" rows="3" className="form-control form-control-sm" value={form.textoAudio} onChange={(e) => cambiar({ textoAudio: e.target.value })}></textarea>
            </div>

            <p className="small mb-0" role="status">
              <strong>El público escuchará:</strong>{' '}
              {fuente ? <><i className={`bi bi-${fuente.icono} me-1`} aria-hidden="true"></i>{fuente.etiqueta}</> : 'ningún audio (solo el nombre y la descripción).'}
            </p>
          </fieldset>
          <p className="small text-secondary-flv mb-0">La imagen se genera automáticamente como avatar ilustrativo (sin fotos reales).</p>
        </form>
      )}
    </Modal>
  );
}
