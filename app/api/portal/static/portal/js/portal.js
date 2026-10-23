/*
 * Mejoras progresivas del sitio Django: todo funciona sin JavaScript (formularios y enlaces normales) y este
 * archivo solo agrega comodidad. Cada bloque se activa con un atributo data-* de las plantillas.
 */
(function () {
  'use strict';

  const todos = (selector, raiz = document) => Array.from(raiz.querySelectorAll(selector));
  const reducirMovimiento = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Selects y switches que envían su formulario al cambiar (filtros, edición del panel, activar/desactivar)
  todos('[data-enviar-al-cambiar]').forEach((campo) => {
    campo.addEventListener('change', () => campo.form && campo.form.submit());
  });

  // Botones de envío: se deshabilitan y muestran «Guardando…» para evitar dobles envíos
  todos('form').forEach((form) => {
    form.addEventListener('submit', () => {
      const boton = form.querySelector('[data-enviando]');
      if (!boton) return;
      boton.disabled = true;
      boton.innerHTML = `<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>${boton.dataset.enviando}`;
    });
  });

  // Formulario del panel en ventana modal: se abre al cargar y al cerrarlo se vuelve al listado
  const modalFormulario = document.querySelector('[data-abrir-al-cargar]');
  if (modalFormulario && window.bootstrap) {
    const modal = new bootstrap.Modal(modalFormulario);
    modalFormulario.addEventListener('hidden.bs.modal', () => { window.location.href = modalFormulario.dataset.volver; });
    modal.show();
  }

  // Votar: exige una opción y, con sesión, pide confirmar en una ventana (sin sesión el servidor lleva al login
  // guardando la opción). El envío real lo hace «Confirmar voto».
  const formVoto = document.querySelector('[data-confirmar-voto]');
  if (formVoto) {
    const errorVoto = document.getElementById('error-voto');
    const modalVoto = document.getElementById('modal-confirmar-voto');
    const elegida = () => document.querySelector('input[name="opcion"][form="form-voto"]:checked');
    todos('input[name="opcion"][form="form-voto"]').forEach((radio) => {
      radio.addEventListener('change', () => { errorVoto.hidden = true; });
    });
    formVoto.addEventListener('submit', (evento) => {
      const opcion = elegida();
      if (!opcion) {
        evento.preventDefault();
        errorVoto.textContent = 'Selecciona una opción antes de votar.';
        errorVoto.hidden = false;
        document.getElementById('lista-opciones').focus();
        return;
      }
      if (formVoto.dataset.conSesion !== '1' || !modalVoto || !window.bootstrap) return;
      evento.preventDefault();
      modalVoto.querySelector('[data-opcion-elegida]').textContent = opcion.dataset.nombre;
      bootstrap.Modal.getOrCreateInstance(modalVoto).show();
    });
    const enviar = modalVoto && modalVoto.querySelector('[data-enviar-voto]');
    if (enviar) {
      enviar.addEventListener('click', () => {
        enviar.disabled = true;
        enviar.innerHTML = '<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Registrando voto…';
        formVoto.submit();
      });
    }
  }

  // Comprobante: el botón «Imprimir» del correo llega con ?imprimir=1; se quita para que recargar no vuelva a imprimir
  if (document.querySelector('[data-imprimir-al-cargar]')) {
    window.history.replaceState(null, '', window.location.pathname);
    window.addEventListener('load', () => window.print());
  }
  todos('[data-imprimir]').forEach((boton) => boton.addEventListener('click', () => window.print()));

  // Panel: la vista previa muestra la presentación de opciones que esté marcada
  todos('[data-vista-previa-opciones]').forEach((previa) => {
    todos('[data-cambiar-vista-previa]').forEach((radio) => {
      radio.addEventListener('change', () => {
        todos('[data-presentacion]', previa).forEach((bloque) => { bloque.hidden = bloque.dataset.presentacion !== radio.value; });
      });
    });
  });

  // Confirmación de borrado compartida
  const modalEliminar = document.getElementById('modal-eliminar');
  todos('[data-eliminar-url]').forEach((boton) => {
    boton.addEventListener('click', () => {
      if (!modalEliminar || !window.bootstrap) return;
      modalEliminar.querySelector('[data-form-eliminar]').action = boton.dataset.eliminarUrl;
      modalEliminar.querySelector('[data-eliminar-texto]').textContent = boton.dataset.eliminarNombre;
      bootstrap.Modal.getOrCreateInstance(modalEliminar).show();
    });
  });

  // Registro: mostrar u ocultar las contraseñas; «Entendido, acepto» marca la política de datos
  todos('[data-mostrar-claves]').forEach((casilla) => {
    casilla.addEventListener('change', () => {
      todos('[data-clave]').forEach((campo) => { campo.type = casilla.checked ? 'text' : 'password'; });
    });
  });
  todos('[data-aceptar]').forEach((boton) => {
    boton.addEventListener('click', () => {
      const casilla = document.querySelector(boton.dataset.aceptar);
      if (casilla) casilla.checked = true;
    });
  });

  // Login en desarrollo: las credenciales de demostración llenan el formulario
  todos('[data-demo-correo]').forEach((boton) => {
    boton.addEventListener('click', () => {
      document.getElementById('correo').value = boton.dataset.demoCorreo;
      document.getElementById('contrasena').value = boton.dataset.demoClave;
    });
  });

  // Cuenta regresiva hasta el cierre o la apertura de una votación
  const cuentas = todos('[data-cuenta-hasta]');
  const pintarCuentas = () => {
    cuentas.forEach((cuenta) => {
      const ms = Math.max(0, new Date(cuenta.dataset.cuentaHasta).getTime() - Date.now());
      const partes = {
        dias: Math.floor(ms / 86400000), horas: Math.floor((ms / 3600000) % 24),
        min: Math.floor((ms / 60000) % 60), seg: Math.floor((ms / 1000) % 60),
      };
      Object.entries(partes).forEach(([parte, valor]) => {
        const celda = cuenta.querySelector(`[data-parte="${parte}"]`);
        if (celda) celda.textContent = String(valor).padStart(2, '0');
      });
      cuenta.setAttribute('aria-label', `${cuenta.getAttribute('aria-label').split(':')[0]}: ${partes.dias} días, ${partes.horas} horas y ${partes.min} minutos`);
    });
  };
  if (cuentas.length) {
    pintarCuentas();
    setInterval(pintarCuentas, 1000);
  }

  // Carrusel del inicio: botón de pausa y respeto por «reducir movimiento»
  todos('[data-pausar-carrusel]').forEach((boton) => {
    const elemento = document.querySelector(boton.dataset.pausarCarrusel);
    if (!elemento || !window.bootstrap) return;
    const carrusel = bootstrap.Carousel.getOrCreateInstance(elemento);
    const marcar = (pausado) => {
      boton.setAttribute('aria-pressed', String(pausado));
      boton.innerHTML = `<i class="bi ${pausado ? 'bi-play-fill' : 'bi-pause-fill'}" aria-hidden="true"></i><span class="visually-hidden">${pausado ? 'Reanudar' : 'Pausar'} el carrusel</span>`;
    };
    let pausado = reducirMovimiento;
    if (pausado) carrusel.pause();
    marcar(pausado);
    boton.addEventListener('click', () => {
      pausado = !pausado;
      if (pausado) carrusel.pause(); else carrusel.cycle();
      marcar(pausado);
    });
  });

  // Selector de íconos del panel: búsqueda, vista previa y nombre del archivo elegido
  todos('[data-selector-icono]').forEach((selector) => {
    const vista = selector.querySelector('[data-vista-previa]');
    const normalizar = (texto) => texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    selector.querySelector('[data-buscar-icono]').addEventListener('input', (e) => {
      const q = normalizar(e.target.value.trim());
      todos('.selector-icono-item', selector).forEach((item) => { item.hidden = q && !normalizar(item.dataset.etiqueta).includes(q); });
    });
    todos('input[name="icono"]', selector).forEach((radio) => {
      radio.addEventListener('change', () => { vista.innerHTML = `<i class="bi bi-${radio.value}"></i>`; });
    });
    const archivo = selector.querySelector('input[type="file"]');
    archivo.addEventListener('change', () => {
      if (archivo.files[0]) selector.querySelector('[data-nombre-archivo]').textContent = `Imagen por subir: ${archivo.files[0].name}`;
    });
  });

  // Votos y resultados «personalizados»: el valor propio solo se edita con la casilla marcada (si no, hereda la edición)
  todos('[data-personalizable]').forEach((bloque) => {
    const casilla = bloque.querySelector('[data-personalizar]');
    const campo = bloque.querySelector('[data-personalizado]');
    const aplicar = () => {
      campo.classList.toggle('opacity-50', !casilla.checked);
      if (campo.tagName === 'SELECT') campo.style.pointerEvents = casilla.checked ? '' : 'none';
      else campo.readOnly = !casilla.checked;
    };
    casilla.addEventListener('change', aplicar);
    aplicar();
  });
})();
