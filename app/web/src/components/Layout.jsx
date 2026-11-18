import { useEffect, useMemo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import Footer from './Footer.jsx';
import AvisoConfirmarCorreo from './AvisoConfirmarCorreo.jsx';
import LimiteErrores from './LimiteErrores.jsx';
import { useApp } from '../context/AppContext.jsx';
import { cssMarca } from '../data/marca.js';

export default function Layout() {
  const { pathname } = useLocation();
  const { configuracion } = useApp();
  // Tema editable desde /panel/marca (colores y botones): se aplica a todo el sitio
  const estilosMarca = useMemo(() => cssMarca(configuracion?.marca), [configuracion?.marca]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  // Con logo propio, la pestaña del navegador también lo usa; sin él vuelve el ícono por defecto
  useEffect(() => {
    const iconos = document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]');
    iconos.forEach((enlace) => {
      if (!enlace.dataset.original) enlace.dataset.original = enlace.getAttribute('href');
      enlace.setAttribute('href', configuracion?.logo || enlace.dataset.original);
      if (enlace.dataset.tipo === undefined) enlace.dataset.tipo = enlace.getAttribute('type') || '';
      if (configuracion?.logo) enlace.removeAttribute('type');
      else if (enlace.dataset.tipo) enlace.setAttribute('type', enlace.dataset.tipo);
    });
  }, [configuracion?.logo]);
  return (
    <div className="d-flex flex-column min-vh-100">
      <style id="flv-marca">{estilosMarca}</style>
      <a href="#contenido" className="skip-link d-print-none" onClick={(e) => { e.preventDefault(); document.getElementById('contenido')?.focus(); }}>
        Saltar al contenido
      </a>
      <Navbar />
      <AvisoConfirmarCorreo />
      <main id="contenido" tabIndex={-1} className="flex-grow-1">
        <LimiteErrores key={pathname}>
          <Outlet />
        </LimiteErrores>
      </main>
      <Footer />
    </div>
  );
}
