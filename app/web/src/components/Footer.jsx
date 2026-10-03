import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import Modal from './Modal.jsx';

const CONTACTO = {
  telefono: '(+57) 315-746 3143',
  telefonoEnlace: '+573157463143',
  direccion: 'Carrera 19 No. 6N-39, Valledupar, Colombia',
  correo: 'presidencia@festivalvallenato.com',
};

const REDES = [
  { nombre: 'Facebook', icono: 'bi-facebook', url: 'https://www.facebook.com/pages/Festival-de-la-Leyenda-Vallenata/112408762110846' },
  { nombre: 'X', icono: 'bi-twitter-x', url: 'https://x.com/FESVALLENATO' },
  { nombre: 'Instagram', icono: 'bi-instagram', url: 'https://www.instagram.com/fesvallenato/' },
  { nombre: 'YouTube', icono: 'bi-youtube', url: 'https://www.youtube.com/channel/UCEB34mUTorkyVnDxgNDCreA' },
];

export default function Footer() {
  const { restablecer, edicionActiva, modo } = useApp();
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
    <footer className="footer-flv mt-5">
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
              {edicionActiva?.nombre || 'Festival de la Leyenda Vallenata'} · Valledupar, Cesar (Colombia). Diseño académico original: no
              representa la marca oficial del Festival ni de la Fundación.
            </p>
          </div>
          <div className="col-sm-6 col-lg-2">
            <p className="fw-semibold text-white mb-2">Navegación</p>
            <ul className="list-unstyled small mb-0">
              <li><Link to="/categorias">Categorías</Link></li>
              <li><Link to="/mis-votos">Mis votos</Link></li>
              <li><Link to="/registro">Registro</Link></li>
              <li><Link to="/admin">Panel admin</Link></li>
              <li><Link to="/marca">Guía de identidad visual</Link></li>
            </ul>
          </div>
          <div className="col-sm-6 col-lg-3">
            <p className="fw-semibold text-white mb-2">Contacto</p>
            <address className="small mb-3 contacto-flv">
              <span className="d-block mb-1">Fundación Festival de la Leyenda Vallenata</span>
              <a className="d-block mb-1" href={`tel:${CONTACTO.telefonoEnlace}`}>
                <i className="bi bi-telephone-fill me-1" aria-hidden="true"></i>{CONTACTO.telefono}
              </a>
              <span className="d-block mb-1">
                <i className="bi bi-geo-alt-fill me-1" aria-hidden="true"></i>{CONTACTO.direccion}
              </span>
              <a className="d-block" href={`mailto:${CONTACTO.correo}`}>
                <i className="bi bi-envelope-fill me-1" aria-hidden="true"></i>{CONTACTO.correo}
              </a>
            </address>
            <ul className="list-inline mb-0 redes-flv" aria-label="Redes sociales del Festival">
              {REDES.map((red) => (
                <li className="list-inline-item" key={red.nombre}>
                  <a href={red.url} target="_blank" rel="noopener noreferrer" aria-label={`${red.nombre} del Festival (se abre en una pestaña nueva)`} title={red.nombre}>
                    <i className={`bi ${red.icono}`} aria-hidden="true"></i>
                  </a>
                </li>
              ))}
            </ul>
          </div>
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
