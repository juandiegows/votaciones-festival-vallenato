import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import Modal from './Modal.jsx';

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
          <div className="col-md-5">
            <p className="font-titulo fw-bold text-white mb-1">Sistema Web de Votaciones</p>
            <p className="small mb-0">
              {edicionActiva?.nombre || 'Festival de la Leyenda Vallenata'} · Valledupar, Cesar (Colombia). Diseño académico original: no
              representa la marca oficial del Festival ni de la Fundación.
            </p>
          </div>
          <div className="col-6 col-md-3">
            <p className="fw-semibold text-white mb-2">Navegación</p>
            <ul className="list-unstyled small mb-0">
              <li><Link to="/categorias">Categorías</Link></li>
              <li><Link to="/mis-votos">Mis votos</Link></li>
              <li><Link to="/registro">Registro</Link></li>
              <li><Link to="/admin">Panel admin</Link></li>
              <li><Link to="/marca">Guía de identidad visual</Link></li>
            </ul>
          </div>
          <div className="col-6 col-md-4">
            <p className="fw-semibold text-white mb-2">Demostración</p>
            {restablecer ? (
              <button type="button" className="btn btn-sm btn-outline-light" onClick={() => setConfirmar(true)}>
                <i className="bi bi-arrow-counterclockwise me-1" aria-hidden="true"></i>Restablecer datos de demostración
              </button>
            ) : (
              <p className="small mb-0">
                <i className="bi bi-hdd-network me-1" aria-hidden="true"></i>
                Los datos se guardan en el servidor del sistema. Restablecer la demostración solo está disponible en la
                versión con datos simulados.
              </p>
            )}
          </div>
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
