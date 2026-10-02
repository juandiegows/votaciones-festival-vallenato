import { Navigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';

// Ruta que exige sesión iniciada (RN-02)
export function RequiereSesion({ children }) {
  const { usuario } = useApp();
  const location = useLocation();
  if (!usuario) return <Navigate to="/login" replace state={{ desde: location.pathname, aviso: 'Debes iniciar sesión para continuar.' }} />;
  return children;
}

// Ruta exclusiva del rol administrador
export function RequiereAdmin({ children }) {
  const { usuario, esAdmin } = useApp();
  const location = useLocation();
  if (!usuario) return <Navigate to="/login" replace state={{ desde: location.pathname, aviso: 'Inicia sesión como administrador para acceder al panel.' }} />;
  if (!esAdmin) {
    return (
      <div className="container py-5 text-center">
        <i className="bi bi-shield-lock display-4 text-danger" aria-hidden="true"></i>
        <h1 className="h3 mt-3">Acceso restringido</h1>
        <p>Esta sección es exclusiva para el rol <strong>administrador</strong>.</p>
      </div>
    );
  }
  return children;
}
