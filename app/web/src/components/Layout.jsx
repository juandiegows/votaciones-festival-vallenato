import { useEffect, useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';
import LimiteErrores from './LimiteErrores.jsx';
import { useApp } from '../context/AppContext.jsx';
import { cssMarca } from '../data/marca.js';

export default function Layout() {
  const { pathname } = useLocation();
  const { edicionActiva, configuracion } = useApp();
  // Tema editable desde /panel/marca (colores y botones): se aplica a todo el sitio
  const estilosMarca = useMemo(() => cssMarca(configuracion?.marca), [configuracion?.marca]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  // El título del documento sigue a la edición activa (sin años fijos en el código)
  useEffect(() => {
    document.title = `Votaciones · ${edicionActiva?.nombre || 'Festival de la Leyenda Vallenata'}`;
  }, [edicionActiva]);
  return (
    <div className="d-flex flex-column min-vh-100">
      <style id="flv-marca">{estilosMarca}</style>
      <a href="#contenido" className="skip-link d-print-none" onClick={(e) => { e.preventDefault(); document.getElementById('contenido')?.focus(); }}>
        Saltar al contenido
      </a>
      <Navbar />
      <main id="contenido" tabIndex={-1} className="flex-grow-1">
        <LimiteErrores key={pathname}>
          <Outlet />
        </LimiteErrores>
      </main>
      <Footer />
    </div>
  );
}
