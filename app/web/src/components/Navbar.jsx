import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';

export default function Navbar() {
  const { usuario, esAdmin, cerrarSesion, edicionActiva } = useApp();
  const [saliendo, setSaliendo] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [menuUsuario, setMenuUsuario] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const menuRef = useRef(null);

  // Cierra los menús al cambiar de ruta
  useEffect(() => {
    setAbierto(false);
    setMenuUsuario(false);
  }, [location.pathname]);

  useEffect(() => {
    const fuera = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenuUsuario(false);
    document.addEventListener('click', fuera);
    return () => document.removeEventListener('click', fuera);
  }, []);

  const salir = async () => {
    setSaliendo(true);
    await cerrarSesion();
    setSaliendo(false);
    navigate('/');
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-flv sticky-top" aria-label="Navegación principal">
      <div className="container">
        <Link className="navbar-brand d-flex align-items-center gap-2" to="/">
          <svg width="36" height="36" viewBox="0 0 64 64" aria-hidden="true">
            <rect width="64" height="64" rx="14" fill="#DD3333" />
            <rect x="12" y="20" width="10" height="26" rx="2" fill="#000000" />
            <rect x="42" y="20" width="10" height="26" rx="2" fill="#000000" />
            <path d="M22 22 L26 44 L30 22 L34 44 L38 22 L42 44" stroke="#D7AC70" strokeWidth="3" fill="none" strokeLinejoin="round" />
          </svg>
          <span>
            Votaciones FLV{edicionActiva ? ` ${edicionActiva.anio}` : ''}
            <small>Prototipo académico</small>
          </span>
        </Link>
        <button
          className="navbar-toggler"
          type="button"
          aria-controls="menu-principal"
          aria-expanded={abierto}
          aria-label={abierto ? 'Cerrar menú' : 'Abrir menú'}
          onClick={() => setAbierto((a) => !a)}
        >
          <i className={`bi ${abierto ? 'bi-x-lg' : 'bi-list'} fs-3`} aria-hidden="true"></i>
        </button>
        <div className={`collapse navbar-collapse ${abierto ? 'show' : ''}`} id="menu-principal">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0 gap-lg-1 mt-2 mt-lg-0">
            <li className="nav-item"><NavLink className="nav-link" to="/" end>Inicio</NavLink></li>
            <li className="nav-item"><NavLink className="nav-link" to="/categorias">Categorías y votaciones</NavLink></li>
            {usuario && <li className="nav-item"><NavLink className="nav-link" to="/mis-votos">Mis votos</NavLink></li>}
            {esAdmin && <li className="nav-item"><NavLink className="nav-link" to="/admin">Panel admin</NavLink></li>}
          </ul>
          {!usuario ? (
            <div className="d-flex flex-column flex-lg-row gap-2 pb-3 pb-lg-0">
              <Link className="btn btn-outline-light" to="/login">
                <i className="bi bi-box-arrow-in-right me-1" aria-hidden="true"></i>Iniciar sesión
              </Link>
              <Link className="btn btn-primary" to="/registro">Registrarse</Link>
            </div>
          ) : (
            <div className="dropdown pb-3 pb-lg-0" ref={menuRef}>
              <button
                className="btn btn-outline-light dropdown-toggle w-100"
                type="button"
                aria-expanded={menuUsuario}
                aria-haspopup="true"
                onClick={() => setMenuUsuario((m) => !m)}
              >
                <i className="bi bi-person-circle me-1" aria-hidden="true"></i>
                {usuario.nombres}
                <span className="visually-hidden"> – menú de usuario</span>
              </button>
              <ul className={`dropdown-menu dropdown-menu-lg-end ${menuUsuario ? 'show' : ''}`}>
                <li className="px-3 py-2 small text-secondary-flv">
                  {usuario.correo}
                  <br />
                  Rol: <strong>{usuario.rol}</strong>
                </li>
                <li><hr className="dropdown-divider" /></li>
                <li><Link className="dropdown-item" to="/mis-votos"><i className="bi bi-receipt me-2" aria-hidden="true"></i>Mis votos</Link></li>
                {esAdmin && <li><Link className="dropdown-item" to="/admin"><i className="bi bi-speedometer2 me-2" aria-hidden="true"></i>Panel admin</Link></li>}
                <li><button className="dropdown-item" type="button" onClick={salir} disabled={saliendo}><i className="bi bi-box-arrow-right me-2" aria-hidden="true"></i>{saliendo ? 'Cerrando sesión…' : 'Cerrar sesión'}</button></li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
