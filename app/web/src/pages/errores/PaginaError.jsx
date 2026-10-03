import { useEffect } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ERRORES } from '../../data/errores.js';
import AcordeonAnimado from '../../components/AcordeonAnimado.jsx';

const recargar = () => window.location.reload();

/** Acciones por defecto según el tipo de error */
function Acciones({ codigo, onReintentar, desde }) {
  const inicio = <Link to="/" className="btn btn-outline-primary"><i className="bi bi-house me-1" aria-hidden="true"></i>Volver al inicio</Link>;
  const reintentar = (
    <button type="button" className="btn btn-primary" onClick={onReintentar || recargar}>
      <i className="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Reintentar
    </button>
  );
  switch (String(codigo)) {
    case '401':
      return (
        <>
          <Link to="/login" state={desde ? { desde } : undefined} className="btn btn-primary">
            <i className="bi bi-box-arrow-in-right me-1" aria-hidden="true"></i>Iniciar sesión
          </Link>
          <Link to="/registro" className="btn btn-outline-primary">Crear una cuenta</Link>
        </>
      );
    case '403':
    case '404':
      return (
        <>
          <Link to="/categorias" className="btn btn-primary"><i className="bi bi-grid me-1" aria-hidden="true"></i>Ver votaciones</Link>
          {inicio}
        </>
      );
    default:
      return <>{reintentar}{inicio}</>;
  }
}

/**
 * Página de error con la marca: código grande, explicación, sugerencias y acciones.
 * `independiente` la muestra a pantalla completa (sin navbar ni pie), p. ej. si la API no responde.
 */
export default function PaginaError({ codigo = 404, titulo, mensaje, sugerencias, acciones, onReintentar, independiente = false, detalle }) {
  const { pathname } = useLocation();
  const e = ERRORES[codigo] || ERRORES[500];
  const esNumero = /^\d+$/.test(String(codigo));

  useEffect(() => {
    if (!independiente) return undefined;
    const anterior = document.title;
    document.title = `${titulo || e.titulo} · Votaciones FLV`;
    return () => { document.title = anterior; };
  }, [independiente, titulo, e.titulo]);

  const contenido = (
    <section className="pagina-error card-flv" aria-labelledby="titulo-error">
      <div className="pagina-error-codigo" aria-hidden="true">
        <AcordeonAnimado />
        <div>
          {esNumero ? <span className="numero d-block">{codigo}</span> : <i className={`bi bi-${e.icono}`}></i>}
          <span className="etiqueta">{esNumero ? 'Error' : 'Aviso'}</span>
        </div>
      </div>
      <div className="pagina-error-texto">
        <p className="small text-uppercase fw-semibold text-rojo mb-1">
          <i className={`bi bi-${e.icono} me-1`} aria-hidden="true"></i>
          {esNumero ? <>Código {codigo}</> : 'Conexión'}
        </p>
        <h1 id="titulo-error" className="h3 mb-2">{titulo || e.titulo}</h1>
        <p className="mb-3" role={independiente ? 'alert' : undefined}>{mensaje || e.mensaje}</p>
        {detalle && <p className="small text-secondary-flv mb-3"><code>{detalle}</code></p>}
        <p className="fw-semibold small mb-1">¿Qué puedes hacer?</p>
        <ul className="small mb-4 ps-3">
          {(sugerencias || e.sugerencias).map((s) => <li key={s}>{s}</li>)}
        </ul>
        <div className="d-flex flex-wrap gap-2">
          {acciones || <Acciones codigo={codigo} onReintentar={onReintentar} desde={pathname} />}
        </div>
      </div>
    </section>
  );

  if (independiente) {
    return <main className="min-vh-100 d-flex align-items-center justify-content-center p-3 p-md-4 fondo-error">{contenido}</main>;
  }
  return <div className="container py-4 py-md-5 d-flex justify-content-center">{contenido}</div>;
}

/** Ruta /error/:codigo (también sirve para revisar todas las páginas de error) */
export function RutaError() {
  const { codigo } = useParams();
  return <PaginaError codigo={ERRORES[codigo] ? codigo : 404} />;
}
