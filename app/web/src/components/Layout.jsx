import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';
import { useApp } from '../context/AppContext.jsx';

export default function Layout() {
  const { pathname } = useLocation();
  const { edicionActiva } = useApp();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  // El título del documento sigue a la edición activa (sin años fijos en el código)
  useEffect(() => {
    document.title = `Votaciones · ${edicionActiva?.nombre || 'Festival de la Leyenda Vallenata'}`;
  }, [edicionActiva]);
  return (
    <div className="d-flex flex-column min-vh-100">
      <a href="#contenido" className="skip-link" onClick={(e) => { e.preventDefault(); document.getElementById('contenido')?.focus(); }}>
        Saltar al contenido
      </a>
      <Navbar />
      <main id="contenido" tabIndex={-1} className="flex-grow-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
