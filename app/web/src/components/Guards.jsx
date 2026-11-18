import { Link, Navigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import PaginaError from '../pages/errores/PaginaError.jsx';
import { DESCRIPCION_PERMISO } from '../data/permisos.js';

// Ruta que exige sesión iniciada (RN-02)
export function RequiereSesion({ children }) {
  const { usuario } = useApp();
  const location = useLocation();
  if (!usuario) return <Navigate to="/login" replace state={{ desde: location.pathname + location.search, aviso: 'Debes iniciar sesión para continuar.' }} />;
  return children;
}

const nombreRol = (usuario) => usuario?.rolNombre || usuario?.rol || 'sin rol';

// Panel de administración: cualquier rol con el permiso panel.ver (administrador, solo lectura, lectura y escritura…)
export function RequiereAdmin({ children }) {
  const { usuario, esAdmin } = useApp();
  const location = useLocation();
  if (!usuario) return <Navigate to="/login" replace state={{ desde: location.pathname + location.search, aviso: 'Inicia sesión con una cuenta de administración para acceder al panel.' }} />;
  if (!esAdmin) {
    return (
      <PaginaError
        codigo={403}
        mensaje={`Tu cuenta tiene el rol «${nombreRol(usuario)}», que no entra al panel de administración. Si necesitas acceso, pídele a un administrador que te asigne un rol del panel.`}
      />
    );
  }
  return children;
}

/** Sección del panel que exige un permiso (normalmente el `.ver` de la sección). Sin él muestra un 403 dentro del panel. */
export function RequierePermiso({ permiso, children }) {
  const { usuario, puede } = useApp();
  if (puede(permiso)) return children;
  return (
    <PaginaError
      codigo={403}
      titulo="Esta sección no está disponible para tu rol"
      mensaje={`Tu rol («${nombreRol(usuario)}») no tiene el permiso «${DESCRIPCION_PERMISO[permiso] || permiso}» (${permiso}). Pídele a un administrador que lo agregue a tu rol en «Roles y permisos».`}
      sugerencias={[
        'El menú del panel muestra solo las secciones que tu rol puede ver.',
        'Si crees que es un error, pídele a un administrador que revise los permisos de tu rol.',
      ]}
      acciones={<Link to="/panel" className="btn btn-primary"><i className="bi bi-speedometer2 me-1" aria-hidden="true"></i>Volver al inicio del panel</Link>}
    />
  );
}
