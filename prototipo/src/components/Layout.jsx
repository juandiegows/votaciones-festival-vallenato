import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';

export default function Layout() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
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
