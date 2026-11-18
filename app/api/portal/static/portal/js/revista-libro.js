/*
 * Revista en PDF que se hojea como un libro (misma lógica que RevistaLibro.jsx de la web React): pdf.js dibuja las
 * páginas bajo demanda y page-flip anima el paso de página (arrastrando la esquina, con los botones o con las
 * flechas del teclado). Se activa en el elemento [data-revista-libro]; sin JavaScript queda el enlace al PDF.
 */
const ANCHO_DIBUJO_MIN = 900;
const ANCHO_DIBUJO_MAX = 2400;
// Páginas dibujadas alrededor de la actual; las lejanas se liberan para no agotar la memoria
const ATRAS = 2;
const ADELANTE = 4;
const CONSERVAR = 10;

const reducirMovimiento = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function textoPaginas(pagina, total, vertical) {
  if (!total) return '';
  if (vertical || pagina === 0 || pagina >= total - 1) return `Página ${pagina + 1} de ${total}`;
  return `Páginas ${pagina + 1} y ${pagina + 2} de ${total}`;
}

const marcador = (i) => `<span class="revista-hoja-cargando">Página ${i + 1}</span>`;

async function iniciar(marco) {
  const { url, titulo, pdfjs, worker, recursos, efecto } = marco.dataset;
  // Ajustes de la revista (/panel/revista); sin ellos, los de siempre
  const duracion = Number(marco.dataset.duracion) || 800;
  const sombra = marco.dataset.sombra === undefined ? 0.45 : Number(marco.dataset.sombra) / 100;
  const tapaDura = marco.dataset.tapaDura !== '0';
  const sonido = marco.dataset.sonido === '1';
  const hojasHost = marco.querySelector('.revista-hojas');
  const estado = marco.querySelector('.revista-estado');
  const controles = marco.querySelector('.revista-controles');
  const btnAnterior = controles.querySelector('[data-accion="anterior"]');
  const btnSiguiente = controles.querySelector('[data-accion="siguiente"]');
  const btnPantalla = controles.querySelector('[data-accion="pantalla"]');
  const btnArrancar = controles.querySelector('[data-accion="arrancar"]');
  const indicador = controles.querySelector('.revista-indicador');

  let flip = null;
  let total = 0;
  let pagina = 0;
  let vertical = false;
  let pantallaCompleta = null; // 'nativa' (API Fullscreen) o 'ventana' (sin la API, p. ej. iPhone)
  let redibujar = () => {};

  const mostrarError = () => {
    estado.setAttribute('role', 'alert');
    estado.innerHTML = '<p class="mb-2">No fue posible cargar la revista.</p>'
      + '<button type="button" class="btn btn-sm btn-outline-light">Reintentar</button>';
    estado.hidden = false;
    estado.querySelector('button').addEventListener('click', () => window.location.reload());
  };

  const actualizarControles = () => {
    const visibles = vertical ? 1 : 2;
    indicador.textContent = textoPaginas(pagina, total, vertical);
    btnAnterior.disabled = pagina === 0;
    btnSiguiente.disabled = pagina + visibles >= total;
  };

  let pdf;
  let proporcion = 1.3;
  try {
    const lib = await import(pdfjs);
    lib.GlobalWorkerOptions.workerSrc = worker;
    pdf = await lib.getDocument({
      url,
      wasmUrl: `${recursos}wasm/`,
      cMapUrl: `${recursos}cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${recursos}standard_fonts/`,
      iccUrl: `${recursos}iccs/`,
      isEvalSupported: false,
    }).promise;
    const base = (await pdf.getPage(1)).getViewport({ scale: 1 });
    proporcion = base.height / base.width;
  } catch (e) {
    mostrarError();
    return;
  }

  total = pdf.numPages;
  const dibujadas = new Map();
  const hojas = Array.from({ length: total }, (_, i) => {
    const hoja = document.createElement('div');
    hoja.className = 'revista-hoja';
    // Portada y contraportada rígidas, como un libro de tapa dura
    if (tapaDura && (i === 0 || i === total - 1)) hoja.dataset.density = 'hard';
    const contenido = document.createElement('div');
    contenido.className = 'revista-hoja-contenido';
    contenido.innerHTML = marcador(i);
    hoja.appendChild(contenido);
    return hoja;
  });

  const dibujar = (i) => {
    if (i < 0 || i >= hojas.length || dibujadas.has(i)) return;
    const tarea = pdf.getPage(i + 1)
      .then(async (p) => {
        const enPantalla = (hojas[i].offsetWidth || 450) * (window.devicePixelRatio || 1);
        const ancho = Math.min(ANCHO_DIBUJO_MAX, Math.max(ANCHO_DIBUJO_MIN, Math.round(enPantalla)));
        const vista = p.getViewport({ scale: ancho / p.getViewport({ scale: 1 }).width });
        const lienzo = document.createElement('canvas');
        lienzo.width = Math.floor(vista.width);
        lienzo.height = Math.floor(vista.height);
        await p.render({ canvas: lienzo, viewport: vista }).promise;
        if (dibujadas.get(i) === tarea) hojas[i].firstChild.replaceChildren(lienzo);
      })
      .catch(() => dibujadas.delete(i));
    dibujadas.set(i, tarea);
  };

  const alrededorDe = (actual) => {
    for (let i = actual - ATRAS; i <= actual + ADELANTE; i++) dibujar(i);
    for (const i of [...dibujadas.keys()]) {
      if (Math.abs(i - actual) > CONSERVAR) {
        dibujadas.delete(i);
        hojas[i].firstChild.innerHTML = marcador(i);
      }
    }
  };

  // Al cambiar de tamaño (p. ej. al maximizar) las páginas cercanas se dibujan de nuevo y las lejanas se liberan
  redibujar = () => {
    if (!flip) return;
    flip.update();
    const actual = flip.getCurrentPageIndex();
    for (const i of [...dibujadas.keys()]) {
      dibujadas.delete(i);
      if (i < actual - ATRAS || i > actual + ADELANTE) hojas[i].firstChild.innerHTML = marcador(i);
    }
    alrededorDe(actual);
  };

  const raiz = document.createElement('div');
  hojasHost.replaceChildren(raiz);
  const ancho = 450;
  flip = new window.St.PageFlip(raiz, {
    width: ancho,
    height: Math.round(ancho * proporcion),
    size: 'stretch',
    minWidth: 200,
    // Sin tope propio: el ancho lo limita el CSS (.revista-hojas), así el libro crece al maximizarlo
    maxWidth: 4000,
    minHeight: Math.round(200 * proporcion),
    maxHeight: Math.round(4000 * proporcion),
    showCover: true,
    usePortrait: true,
    mobileScrollSupport: true,
    maxShadowOpacity: sombra,
    flippingTime: reducirMovimiento() ? Math.min(250, duracion) : duracion,
  });
  flip.loadFromHTML(hojas);

  const ajustarProporcion = () => marco.style.setProperty('--revista-ancho-por-alto', (vertical ? 1 : 2) / proporcion);
  flip.on('flip', (e) => {
    pagina = e.data;
    alrededorDe(pagina);
    actualizarControles();
  });
  flip.on('changeOrientation', (e) => {
    vertical = e.data === 'portrait';
    ajustarProporcion();
    actualizarControles();
  });
  vertical = flip.getOrientation() === 'portrait';
  ajustarProporcion();
  alrededorDe(0);

  estado.hidden = true;
  hojasHost.removeAttribute('aria-hidden');
  controles.hidden = false;
  actualizarControles();

  // Pantalla completa: API nativa y, si no existe, el libro cubre la ventana con CSS
  const aplicarPantalla = (modo) => {
    pantallaCompleta = modo;
    marco.classList.toggle('revista-pantalla-completa', Boolean(modo));
    document.body.style.overflow = modo === 'ventana' ? 'hidden' : '';
    btnPantalla?.setAttribute('aria-label', modo ? 'Salir de pantalla completa' : 'Ver en pantalla completa');
    if (btnPantalla) btnPantalla.firstElementChild.className = `bi bi-${modo ? 'fullscreen-exit' : 'arrows-fullscreen'}`;
    requestAnimationFrame(() => redibujar());
  };
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement === marco) aplicarPantalla('nativa');
    else if (pantallaCompleta === 'nativa') aplicarPantalla(null);
  });
  btnPantalla?.addEventListener('click', () => {
    if (pantallaCompleta === 'ventana') aplicarPantalla(null);
    else if (document.fullscreenElement) document.exitFullscreen();
    else if (marco.requestFullscreen) marco.requestFullscreen().catch(() => aplicarPantalla('ventana'));
    else aplicarPantalla('ventana');
    marco.focus();
  });

  // Al estirar la ventana o cambiar el zoom (densidad de píxeles) las páginas se dibujan de nuevo a la nueva
  // resolución; si no, el navegador agranda el dibujo anterior y se ve pixelado. Espera a que termine el cambio.
  if (typeof ResizeObserver !== 'undefined') {
    let anchoPrevio = 0;
    let densidad = window.devicePixelRatio || 1;
    let espera = 0;
    new ResizeObserver(([entrada]) => {
      const nuevo = entrada.contentRect.width;
      const nuevaDensidad = window.devicePixelRatio || 1;
      if (!anchoPrevio) {
        anchoPrevio = nuevo;
        return;
      }
      if (Math.abs(nuevo - anchoPrevio) / anchoPrevio < 0.1 && nuevaDensidad === densidad) return;
      clearTimeout(espera);
      espera = setTimeout(() => {
        anchoPrevio = nuevo;
        densidad = nuevaDensidad;
        redibujar();
      }, 250);
    }).observe(hojasHost);
    window.matchMedia?.(`(resolution: ${densidad}dppx)`).addEventListener?.('change', () => {
      densidad = window.devicePixelRatio || 1;
      redibujar();
    });
  }

  // Efecto 3D «arrancar la página» (si está activo en /panel/revista): misma lógica que RevistaLibro.jsx
  let arrancando = false;
  const arrancar = async (izquierda = false) => {
    if (arrancando || !efecto) return;
    const actual = flip.getCurrentPageIndex();
    let indice = actual;
    let lomoIzquierda = true;
    if (!vertical && actual > 0) {
      // Por defecto la de la derecha; al estirar hacia atrás, la de la izquierda
      if (!izquierda && actual + 1 < hojas.length) indice = actual + 1;
      else lomoIzquierda = false;
    }
    const contenido = hojas[indice]?.firstChild;
    const lienzo = contenido?.querySelector('canvas');
    if (!lienzo) return;
    arrancando = true;
    if (btnArrancar) btnArrancar.disabled = true;
    const debajo = hojas[lomoIzquierda ? indice + 1 : indice - 1]?.querySelector('canvas');
    let copia = null;
    const ocultar = () => {
      if (debajo) {
        copia = document.createElement('canvas');
        copia.width = debajo.width;
        copia.height = debajo.height;
        copia.getContext('2d').drawImage(debajo, 0, 0);
        copia.className = 'revista-hoja-debajo';
        hojas[indice].appendChild(copia);
      }
      contenido.style.visibility = 'hidden';
    };
    const mostrar = () => {
      copia?.remove();
      contenido.style.visibility = '';
      contenido.classList.add('revista-hoja-vuelve');
      setTimeout(() => contenido.classList.remove('revista-hoja-vuelve'), 600);
    };
    try {
      if (reducirMovimiento()) {
        ocultar();
        await new Promise((listo) => setTimeout(listo, 300));
        mostrar();
      } else {
        const { arrancarPagina } = await import(efecto);
        await arrancarPagina({
          lienzo, rect: lienzo.getBoundingClientRect(), lomoIzquierda, ocultar, mostrar, sonido,
          capaPadre: document.fullscreenElement || document.body,
        });
      }
    } catch {
      mostrar();
    } finally {
      arrancando = false;
      if (btnArrancar) btnArrancar.disabled = false;
    }
  };
  btnArrancar?.addEventListener('click', () => arrancar());

  // Estirar la esquina fuera del libro arranca la página (misma lógica que estirarParaArrancar.js de la web)
  if (efecto) {
    let plegando = false;
    flip.on('changeState', (e) => {
      plegando = e.data === 'user_fold';
    });
    const soltarDoblez = () => {
      try {
        flip.isUserTouch = false;
        flip.isUserMove = false;
        const control = flip.getFlipController();
        const render = flip.getRender();
        render.finishAnimation();
        render.setBottomPage(null);
        render.setFlippingPage(null);
        render.clearShadow();
        control.setState('read');
        control.reset();
        flip.update();
      } catch {
        /* si cambia la librería, el arrastre sigue normal */
      }
    };
    const alMover = (evento) => {
      if (!plegando || reducirMovimiento()) return;
      const punto = evento.touches?.[0] || evento;
      const caja = hojasHost.getBoundingClientRect();
      const margen = Math.max(40, caja.width * 0.08);
      const fuera = punto.clientX < caja.left - margen || punto.clientX > caja.right + margen
        || punto.clientY < caja.top - margen || punto.clientY > caja.bottom + margen;
      if (!fuera) return;
      plegando = false;
      const izquierda = flip.getFlipController().getCalculation()?.getDirection() === 1; // FlipDirection.BACK
      soltarDoblez();
      arrancar(izquierda);
    };
    window.addEventListener('mousemove', alMover);
    window.addEventListener('touchmove', alMover, { passive: true });
  }

  btnAnterior.addEventListener('click', () => flip.flipPrev());
  btnSiguiente.addEventListener('click', () => flip.flipNext());
  marco.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      flip.flipPrev();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      flip.flipNext();
    } else if (e.key === 'Escape' && pantallaCompleta === 'ventana') {
      aplicarPantalla(null);
    }
  });
  marco.setAttribute('aria-label', titulo);
}

document.querySelectorAll('[data-revista-libro]').forEach((marco) => { iniciar(marco); });
