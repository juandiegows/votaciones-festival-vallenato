import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';

// Estado vacío cuando no hay una edición activa configurada
export default function SinEdicion() {
  const { esAdmin } = useApp();
  return (
    <div className="container py-5">
      <div className="card-flv p-4 p-md-5 text-center mx-auto" style={{ maxWidth: '36rem' }}>
        <i className="bi bi-calendar-x display-5 text-rojo" aria-hidden="true"></i>
        <h1 className="h3 mt-3">Aún no hay una edición activa</h1>
        <p className="mb-4">
          Las votaciones del público se publicarán cuando la organización active la próxima edición del Festival.
        </p>
        {esAdmin ? (
          <Link to="/admin/ediciones" className="btn btn-primary">Configurar una edición</Link>
        ) : (
          <Link to="/registro" className="btn btn-outline-primary">Crear una cuenta</Link>
        )}
      </div>
    </div>
  );
}
