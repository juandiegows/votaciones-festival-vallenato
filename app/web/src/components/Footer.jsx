import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import Modal from './Modal.jsx';

export default function Footer() {
  const { usuario, esAdmin, restablecer, edicionActiva, modo, configuracion: contacto, redes } = useApp();
  // Contacto y redes editables en /panel/sitio
  const redesActivas = [...redes].filter((r) => r.activa).sort((a, b) => a.orden - b.orden);
  const [confirmar, setConfirmar] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const navigate = useNavigate();

  const ejecutar = async () => {
    setProcesando(true);
    await restablecer();
    setProcesando(false);
    setConfirmar(false);
    navigate('/');
  };

  return (
    <footer className="footer-flv mt-5 d-print-none">
      <div className="aviso-prototipo text-center py-2 px-3">
        <i className="bi bi-info-circle-fill me-1" aria-hidden="true"></i>
        Prototipo académico – Areandina · Desarrollo Web 2026 ·{' '}
        {modo === 'api' ? 'Datos ilustrativos de demostración' : 'Datos simulados'}
      </div>
      <div className="container py-4">
        <div className="row g-4">
          <div className="col-lg-4">
            <p className="font-titulo fw-bold text-white mb-1">Sistema Web de Votaciones</p>
            <p className="small mb-0">
              {edicionActiva?.nombre || 'Festival de la Leyenda Vallenata'} · Valledupar, Cesar (Colombia). {contacto?.textoPie}
            </p>
          </div>
          <div className="col-sm-6 col-lg-2">
            <p className="fw-semibold text-white mb-2">Navegación</p>
            <ul className="list-unstyled small mb-0">
              <li><Link to="/categorias">Categorías</Link></li>
              {usuario && <li><Link to="/mis-votos">Mis votos</Link></li>}
              <li><Link to="/registro">Registro</Link></li>
              {/* El acceso al panel solo aparece aquí, y solo para administradores con sesión */}
              {esAdmin && <li><Link to="/panel">Panel admin</Link></li>}
            </ul>
          </div>
          {contacto && <div className="col-sm-6 col-lg-3">
            <p className="fw-semibold text-white mb-2">Contacto</p>
            <address className="small mb-3 contacto-flv">
              <span className="d-block mb-1">{contacto.nombreOrganizacion}</span>
              <a className="d-block mb-1" href={`tel:${contacto.telefono.replace(/[^\d+]/g, '')}`}>
                <i className="bi bi-telephone-fill me-1" aria-hidden="true"></i>{contacto.telefono}
              </a>
              <span className="d-block mb-1">
                <i className="bi bi-geo-alt-fill me-1" aria-hidden="true"></i>{contacto.direccion}
              </span>
              <a className="d-block" href={`mailto:${contacto.correo}`}>
                <i className="bi bi-envelope-fill me-1" aria-hidden="true"></i>{contacto.correo}
              </a>
            </address>
            <ul className="list-inline mb-0 redes-flv" aria-label="Redes sociales del Festival">
              {redesActivas.map((red) => (
                <li className="list-inline-item" key={red.id}>
                  <a href={red.url} target="_blank" rel="noopener noreferrer" aria-label={`${red.nombre} del Festival (se abre en una pestaña nueva)`} title={red.nombre}>
                    <i className={`bi bi-${red.icono}`} aria-hidden="true"></i>
                  </a>
                </li>
              ))}
            </ul>
          </div>}
          {restablecer && (
            <div className="col-sm-6 col-lg-3">
              <p className="fw-semibold text-white mb-2">Demostración</p>
              <button type="button" className="btn btn-sm btn-outline-light" onClick={() => setConfirmar(true)}>
                <i className="bi bi-arrow-counterclockwise me-1" aria-hidden="true"></i>Restablecer datos de demostración
              </button>
            </div>
          )}
        </div>
        <hr className="border-secondary" />
        <p className="small mb-0">
          <strong>Acerca de:</strong> Sebastián Bautista Martínez, María Labarca Briceño, Juan Mejía Maestre · Fundación
          Universitaria del Área Andina · Desarrollo Web – Eje 1, Entrega 1.
        </p>
      </div>

      <Modal
        abierto={confirmar}
        titulo="Restablecer datos de demostración"
        onCerrar={() => setConfirmar(false)}
        pie={
          <>
            <button className="btn btn-outline-secondary" onClick={() => setConfirmar(false)}>Cancelar</button>
            <button className="btn btn-peligro" onClick={ejecutar} disabled={procesando}>Sí, restablecer</button>
          </>
        }
      >
        <p className="mb-0">
          Se borrarán los cambios guardados en este navegador (votos, registros y ediciones de administración) y se
          cargarán de nuevo los datos simulados. También se cerrará la sesión.
        </p>
      </Modal>
    </footer>
  );
}
