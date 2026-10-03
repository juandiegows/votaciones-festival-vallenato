import { Navigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import PaginaError from '../pages/errores/PaginaError.jsx';

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
    return <PaginaError codigo={403} mensaje="Esta sección es exclusiva para el rol administrador y tu cuenta es de votante." />;
  }
  return children;
}
