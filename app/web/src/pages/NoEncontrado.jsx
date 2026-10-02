import { Link } from 'react-router-dom';

export default function NoEncontrado({ mensaje = 'La página que buscas no existe.' }) {
  return (
    <div className="container py-5 text-center">
      <i className="bi bi-music-note-list display-3 text-rojo" aria-hidden="true"></i>
      <h1 className="h3 mt-3">No encontramos esta página</h1>
      <p>{mensaje}</p>
      <Link to="/" className="btn btn-primary">Volver al inicio</Link>
    </div>
  );
}
