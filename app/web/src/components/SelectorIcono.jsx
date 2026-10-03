import { useEffect, useId, useMemo, useState } from 'react';
import { ICONOS_DISPONIBLES, etiquetaIcono } from '../data/presentaciones.js';

const TAMANO_MAXIMO = 1024 * 1024; // 1 MB
const FORMATOS = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * Selector visual de ícono: cuadrícula de íconos (semántica radio) con búsqueda,
 * o una imagen subida desde el equipo (PNG, JPG o WebP de hasta 1 MB).
 *
 * Trabaja sobre los campos del formulario: `icono`, `iconoImagen` (URL guardada),
 * `archivoIcono` (File por subir) y `quitarIcono`. `onCambio(parcial)` devuelve los campos que cambian.
 */
export default function SelectorIcono({ icono, iconoImagen, archivoIcono, quitarIcono, onCambio, leyenda = 'Ícono' }) {
  const id = useId();
  const [busqueda, setBusqueda] = useState('');
  const [error, setError] = useState('');
  const [vistaPrevia, setVistaPrevia] = useState('');

  useEffect(() => {
    if (!archivoIcono) {
      setVistaPrevia('');
      return undefined;
    }
    const url = URL.createObjectURL(archivoIcono);
    setVistaPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [archivoIcono]);

  const imagenActual = vistaPrevia || (!quitarIcono && iconoImagen) || '';

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (!q) return ICONOS_DISPONIBLES;
    return ICONOS_DISPONIBLES.filter((i) =>
      `${i.etiqueta} ${i.nombre}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q)
    );
  }, [busqueda]);

  // Si el ícono guardado no está en el catálogo, se muestra igual para no perderlo
  const lista = icono && !ICONOS_DISPONIBLES.some((i) => i.nombre === icono) && !busqueda
    ? [{ nombre: icono, etiqueta: etiquetaIcono(icono) }, ...filtrados]
    : filtrados;

  const subir = (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    if (!FORMATOS.includes(archivo.type)) return setError('Formato no permitido: usa una imagen PNG, JPG o WebP.');
    if (archivo.size > TAMANO_MAXIMO) return setError('La imagen supera 1 MB. Redúcela e inténtalo de nuevo.');
    setError('');
    onCambio({ archivoIcono: archivo, quitarIcono: false });
  };

  const quitarImagen = () => {
    setError('');
    onCambio({ archivoIcono: null, quitarIcono: Boolean(iconoImagen) });
  };

  return (
    <fieldset className="selector-icono">
      <legend className="form-label mb-1">{leyenda}</legend>
      <div className="d-flex flex-wrap align-items-center gap-3 mb-2">
        <span className="icono-circulo icono-vista-previa" aria-hidden="true">
          {imagenActual ? <img src={imagenActual} alt="" className="icono-entidad-img" /> : <i className={`bi bi-${icono || 'check2-square'}`}></i>}
        </span>
        <div className="small">
          <p className="mb-0 fw-semibold">
            {imagenActual ? (archivoIcono ? `Imagen por subir: ${archivoIcono.name}` : 'Imagen subida') : etiquetaIcono(icono)}
          </p>
          <p className="mb-0 text-secondary-flv">
            {imagenActual ? 'La imagen reemplaza al ícono de la lista.' : 'Elige un ícono de la lista o sube una imagen.'}
          </p>
        </div>
      </div>

      <label htmlFor={`${id}-buscar`} className="visually-hidden">Buscar ícono</label>
      <div className="input-group input-group-sm mb-2">
        <span className="input-group-text" aria-hidden="true"><i className="bi bi-search"></i></span>
        <input id={`${id}-buscar`} type="search" className="form-control" placeholder="Buscar: música, trofeo, personas…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      </div>

      <div className={`selector-icono-cuadricula ${imagenActual ? 'con-imagen' : ''}`} role="radiogroup" aria-label="Íconos disponibles">
        {lista.map((i) => {
          const marcado = !imagenActual && icono === i.nombre;
          return (
            <span key={i.nombre} className="selector-icono-item">
              <input
                type="radio"
                className="opcion-input"
                name={`${id}-icono`}
                id={`${id}-${i.nombre}`}
                checked={marcado}
                onChange={() => onCambio({ icono: i.nombre, archivoIcono: null, quitarIcono: Boolean(iconoImagen) })}
              />
              <label htmlFor={`${id}-${i.nombre}`} title={i.etiqueta}>
                <i className={`bi bi-${i.nombre}`} aria-hidden="true"></i>
                <span className="selector-icono-nombre">{i.etiqueta}</span>
              </label>
            </span>
          );
        })}
        {lista.length === 0 && <p className="small text-secondary-flv mb-0 p-2">No hay íconos con «{busqueda}».</p>}
      </div>

      <div className="d-flex flex-wrap align-items-center gap-2 mt-2">
        <label className="btn btn-sm btn-outline-primary mb-0" htmlFor={`${id}-archivo`}>
          <i className="bi bi-upload me-1" aria-hidden="true"></i>Subir desde tu equipo
        </label>
        <input id={`${id}-archivo`} type="file" accept="image/png,image/jpeg,image/webp" className="visually-hidden" onChange={subir} aria-describedby={`${id}-ayuda`} />
        {imagenActual && (
          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={quitarImagen}>
            <i className="bi bi-x-lg me-1" aria-hidden="true"></i>Quitar imagen
          </button>
        )}
        <span id={`${id}-ayuda`} className="form-text mt-0">PNG, JPG o WebP de hasta 1 MB; se recomienda cuadrada.</span>
      </div>
      {error && <div className="invalid-feedback d-block" role="alert">{error}</div>}
    </fieldset>
  );
}
