import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import Modal from '../components/Modal.jsx';
import PoliticaDatos from '../components/PoliticaDatos.jsx';
import { validarContrasena, validarCorreo } from '../utils/helpers.js';

const INICIAL = { nombres: '', apellidos: '', correo: '', contrasena: '', confirmacion: '', aceptaTratamientoDatos: false };

function validar(f) {
  const e = {};
  if (f.nombres.trim().length < 2) e.nombres = 'Ingresa tus nombres.';
  if (f.apellidos.trim().length < 2) e.apellidos = 'Ingresa tus apellidos.';
  if (!validarCorreo(f.correo)) e.correo = 'Ingresa un correo electrónico válido.';
  if (!validarContrasena(f.contrasena)) e.contrasena = 'Mínimo 8 caracteres, con una mayúscula, un número y un símbolo.';
  if (f.confirmacion !== f.contrasena || !f.confirmacion) e.confirmacion = 'Las contraseñas no coinciden.';
  if (!f.aceptaTratamientoDatos) e.aceptaTratamientoDatos = 'Debes aceptar la política de tratamiento de datos para registrarte (RN-10).';
  return e;
}

export default function Registro() {
  const { registrarUsuario } = useApp();
  const [form, setForm] = useState(INICIAL);
  const [errores, setErrores] = useState({});
  const [enviado, setEnviado] = useState(false);
  const [errorGeneral, setErrorGeneral] = useState('');
  const [verPolitica, setVerPolitica] = useState(false);
  const [verClave, setVerClave] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const cambiar = (e) => {
    const { name, value, type, checked } = e.target;
    const nuevo = { ...form, [name]: type === 'checkbox' ? checked : value };
    setForm(nuevo);
    if (enviado) setErrores(validar(nuevo));
  };

  const enviar = (e) => {
    e.preventDefault();
    setEnviado(true);
    const errs = validar(form);
    setErrores(errs);
    if (Object.keys(errs).length) {
      document.getElementById(Object.keys(errs)[0])?.focus();
      return;
    }
    const r = registrarUsuario(form);
    if (!r.ok) return setErrorGeneral(r.error);
    navigate(location.state?.desde || '/categorias', { replace: true });
  };

  const campo = (name, label, type = 'text', extra = {}) => (
    <div className="mb-3">
      <label htmlFor={name} className="form-label">{label} <span className="text-danger" aria-hidden="true">*</span></label>
      <input
        id={name}
        name={name}
        type={type}
        className={`form-control ${errores[name] ? 'is-invalid' : ''}`}
        value={form[name]}
        onChange={cambiar}
        required
        aria-invalid={!!errores[name]}
        aria-describedby={errores[name] ? `${name}-error` : extra.ayuda ? `${name}-ayuda` : undefined}
        {...extra.attrs}
      />
      {extra.ayuda && !errores[name] && <div id={`${name}-ayuda`} className="form-text">{extra.ayuda}</div>}
      {errores[name] && <div id={`${name}-error`} className="invalid-feedback">{errores[name]}</div>}
    </div>
  );

  return (
    <div className="container py-4 py-md-5">
      <div className="row justify-content-center">
        <div className="col-md-9 col-lg-7 col-xl-6">
          <div className="card-flv p-4 p-md-5">
            <h1 className="h3 mb-1">Crear cuenta de votante</h1>
            <p className="text-secondary-flv">Regístrate para participar en las votaciones del público (RF-01).</p>
            {errorGeneral && <div className="alert alert-danger" role="alert">{errorGeneral}</div>}
            <form noValidate onSubmit={enviar}>
              <div className="row">
                <div className="col-sm-6">{campo('nombres', 'Nombres', 'text', { attrs: { autoComplete: 'given-name' } })}</div>
                <div className="col-sm-6">{campo('apellidos', 'Apellidos', 'text', { attrs: { autoComplete: 'family-name' } })}</div>
              </div>
              {campo('correo', 'Correo electrónico', 'email', { attrs: { autoComplete: 'email', placeholder: 'nombre@correo.com' } })}
              {campo('contrasena', 'Contraseña', verClave ? 'text' : 'password', {
                ayuda: 'Mínimo 8 caracteres, con una mayúscula, un número y un símbolo.',
                attrs: { autoComplete: 'new-password' },
              })}
              {campo('confirmacion', 'Confirmar contraseña', verClave ? 'text' : 'password', { attrs: { autoComplete: 'new-password' } })}
              <div className="form-check mb-3">
                <input className="form-check-input" type="checkbox" id="verClave" checked={verClave} onChange={(e) => setVerClave(e.target.checked)} />
                <label className="form-check-label small" htmlFor="verClave">Mostrar contraseñas</label>
              </div>

              <div className="alert alert-warning small py-2" role="note">
                <i className="bi bi-hourglass-split me-1" aria-hidden="true"></i>
                Campos adicionales (documento, municipio, edad) pendientes de validación con la Fundación.
              </div>

              <div className="form-check mb-4">
                <input
                  className={`form-check-input ${errores.aceptaTratamientoDatos ? 'is-invalid' : ''}`}
                  type="checkbox"
                  id="aceptaTratamientoDatos"
                  name="aceptaTratamientoDatos"
                  checked={form.aceptaTratamientoDatos}
                  onChange={cambiar}
                  aria-invalid={!!errores.aceptaTratamientoDatos}
                  aria-describedby={errores.aceptaTratamientoDatos ? 'aceptaTratamientoDatos-error' : undefined}
                />
                <label className="form-check-label" htmlFor="aceptaTratamientoDatos">
                  Acepto la{' '}
                  <button type="button" className="btn btn-link p-0 align-baseline fw-semibold" onClick={() => setVerPolitica(true)}>
                    política de tratamiento de datos personales
                  </button>{' '}
                  (Ley 1581 de 2012). <span className="text-danger" aria-hidden="true">*</span>
                </label>
                {errores.aceptaTratamientoDatos && (
                  <div id="aceptaTratamientoDatos-error" className="invalid-feedback">{errores.aceptaTratamientoDatos}</div>
                )}
              </div>

              <button type="submit" className="btn btn-primary btn-lg w-100">
                <i className="bi bi-person-check me-2" aria-hidden="true"></i>Crear cuenta
              </button>
            </form>
            <p className="text-center mt-3 mb-0">
              ¿Ya tienes cuenta? <Link to="/login" state={location.state}>Inicia sesión</Link>
            </p>
          </div>
        </div>
      </div>

      <Modal
        abierto={verPolitica}
        titulo="Política de tratamiento de datos"
        onCerrar={() => setVerPolitica(false)}
        pie={
          <button
            className="btn btn-primary"
            onClick={() => {
              const nuevo = { ...form, aceptaTratamientoDatos: true };
              setForm(nuevo);
              if (enviado) setErrores(validar(nuevo));
              setVerPolitica(false);
            }}
          >
            Entendido, acepto
          </button>
        }
      >
        <PoliticaDatos />
      </Modal>
    </div>
  );
}
