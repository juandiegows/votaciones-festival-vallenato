import { useEffect, useRef, useState } from 'react';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import urlWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PageFlip } from 'page-flip';
import { urlDelSitio } from '../config.js';
import { ajustesDe } from '../data/revista.js';
import Cargando from './Cargando.jsx';
import { vigilarEstiramiento } from './revista/estirarParaArrancar.js';

GlobalWorkerOptions.workerSrc = urlWorker;

// Ancho en píxeles con que se dibuja cada página: el tamaño en pantalla × densidad de píxeles, entre estos límites
const ANCHO_DIBUJO_MIN = 900;
const ANCHO_DIBUJO_MAX = 2400;
// Páginas dibujadas alrededor de la actual; las lejanas se liberan para no agotar la memoria
const ATRAS = 2;
const ADELANTE = 4;
const CONSERVAR = 10;

const reducirMovimiento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function textoPaginas(pagina, total, vertical) {
  if (!total) return '';
  if (vertical || pagina === 0 || pagina >= total - 1) return `Página ${pagina + 1} de ${total}`;
  return `Páginas ${pagina + 1} y ${pagina + 2} de ${total}`;
}

/**
 * Revista en PDF que se hojea como un libro: pdf.js dibuja las páginas bajo demanda y page-flip
 * anima el paso de página (arrastrando la esquina, con los botones o con las flechas del teclado).
 * page-flip maneja su propio DOM, por eso las hojas se crean fuera de React dentro de `contenedor`.
 */
export default function RevistaLibro({ url, titulo, ajustes: ajustesRevista }) {
  // Ajustes de /panel/revista; sin ellos, los de siempre
  const ajustes = ajustesDe(ajustesRevista);
  const marco = useRef(null);
  const contenedor = useRef(null);
  const libro = useRef(null);
  // Vuelve a dibujar las páginas visibles (al cambiar de tamaño, p. ej. al maximizar)
  const redibujar = useRef(() => {});
  const [estado, setEstado] = useState({ cargando: true, error: null });
  const [pagina, setPagina] = useState(0);
  const [total, setTotal] = useState(0);
  const [vertical, setVertical] = useState(false);
  // 'nativa' (API Fullscreen) o 'ventana' (sin la API, p. ej. iPhone: el libro cubre la ventana con CSS)
  const [pantallaCompleta, setPantallaCompleta] = useState(null);
  const [proporcion, setProporcion] = useState(1.3);
  const [intento, setIntento] = useState(0);
  // Hojas del libro (DOM de page-flip) y si el efecto de arrancar una página está en curso
  const hojasLibro = useRef([]);
  const [arrancando, setArrancando] = useState(false);
  // La última versión de arrancar() y de los ajustes, para el arrastre que vigila page-flip fuera de React
  const arrancarRef = useRef(() => {});
  const efectoActivo = useRef(false);
  efectoActivo.current = ajustes.efectoArrancar;

  useEffect(() => {
    let cancelado = false;
    let flip = null;
    let dejarDeVigilar = () => {};
    const host = contenedor.current;
    // Sin estos recursos pdf.js no puede decodificar imágenes JPEG 2000/JBIG2 ni algunas fuentes (ver vite.config.js)
    const recursos = urlDelSitio('/pdfjs/');
    const tarea = getDocument({
      url,
      wasmUrl: `${recursos}wasm/`,
      cMapUrl: `${recursos}cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `${recursos}standard_fonts/`,
      iccUrl: `${recursos}iccs/`,
      // La CSP (nginx-seguridad.conf) no permite eval: así pdf.js no intenta compilar fuentes con new Function
      isEvalSupported: false,
    });
    const dibujadas = new Map();
    setEstado({ cargando: true, error: null });
    setPagina(0);

    tarea.promise
      .then(async (pdf) => {
        const primera = await pdf.getPage(1);
        if (cancelado) return;
        const base = primera.getViewport({ scale: 1 });
        const proporcion = base.height / base.width;
        setProporcion(proporcion);

        const hojas = Array.from({ length: pdf.numPages }, (_, i) => {
          const hoja = document.createElement('div');
          hoja.className = 'revista-hoja';
          // Portada y contraportada rígidas, como un libro de tapa dura
          if (ajustes.tapaDura && (i === 0 || i === pdf.numPages - 1)) hoja.dataset.density = 'hard';
          const contenido = document.createElement('div');
          contenido.className = 'revista-hoja-contenido';
          contenido.innerHTML = `<span class="revista-hoja-cargando">Página ${i + 1}</span>`;
          hoja.appendChild(contenido);
          return hoja;
        });

        const dibujar = (i) => {
          if (i < 0 || i >= hojas.length || dibujadas.has(i)) return;
          const tareaPagina = pdf
            .getPage(i + 1)
            .then(async (p) => {
              const enPantalla = (hojas[i].offsetWidth || 450) * (window.devicePixelRatio || 1);
              const ancho = Math.min(ANCHO_DIBUJO_MAX, Math.max(ANCHO_DIBUJO_MIN, Math.round(enPantalla)));
              const vista = p.getViewport({ scale: ancho / p.getViewport({ scale: 1 }).width });
              const lienzo = document.createElement('canvas');
              lienzo.width = Math.floor(vista.width);
              lienzo.height = Math.floor(vista.height);
              await p.render({ canvas: lienzo, viewport: vista }).promise;
              if (!cancelado && dibujadas.get(i) === tareaPagina) hojas[i].firstChild.replaceChildren(lienzo);
            })
            .catch(() => dibujadas.delete(i));
          dibujadas.set(i, tareaPagina);
        };

        const alrededorDe = (actual) => {
          for (let i = actual - ATRAS; i <= actual + ADELANTE; i++) dibujar(i);
          for (const i of [...dibujadas.keys()]) {
            if (Math.abs(i - actual) > CONSERVAR) {
              dibujadas.delete(i);
              hojas[i].firstChild.innerHTML = `<span class="revista-hoja-cargando">Página ${i + 1}</span>`;
            }
          }
        };

        // Las páginas cercanas se repiten a la nueva resolución (el lienzo anterior se ve mientras tanto) y las lejanas se liberan
        redibujar.current = () => {
          if (!flip) return;
          flip.update();
          const actual = flip.getCurrentPageIndex();
          for (const i of [...dibujadas.keys()]) {
            dibujadas.delete(i);
            if (i < actual - ATRAS || i > actual + ADELANTE) {
              hojas[i].firstChild.innerHTML = `<span class="revista-hoja-cargando">Página ${i + 1}</span>`;
            }
          }
          alrededorDe(actual);
        };

        const raiz = document.createElement('div');
        host.replaceChildren(raiz);
        const ancho = 450;
        const alto = Math.round(ancho * proporcion);
        flip = new PageFlip(raiz, {
          width: ancho,
          height: alto,
          size: 'stretch',
          minWidth: 200,
          // Sin tope propio: el ancho lo limita el CSS (.revista-hojas), así el libro crece al maximizarlo
          maxWidth: 4000,
          minHeight: Math.round(200 * proporcion),
          maxHeight: Math.round(4000 * proporcion),
          showCover: true,
          usePortrait: true,
          mobileScrollSupport: true,
          maxShadowOpacity: ajustes.sombra / 100,
          flippingTime: reducirMovimiento() ? Math.min(250, ajustes.duracionPaso) : ajustes.duracionPaso,
        });
        hojasLibro.current = hojas;
        flip.loadFromHTML(hojas);
        flip.on('flip', (e) => {
          setPagina(e.data);
          alrededorDe(e.data);
        });
        flip.on('changeOrientation', (e) => setVertical(e.data === 'portrait'));
        libro.current = flip;
        // Estirar la esquina fuera del libro arranca la página (si el efecto está activo)
        dejarDeVigilar = vigilarEstiramiento({
          flip, contenedor: host, activo: () => efectoActivo.current && !reducirMovimiento(),
          alArrancar: (opciones) => arrancarRef.current(opciones),
        });
        setVertical(flip.getOrientation() === 'portrait');
        setTotal(pdf.numPages);
        alrededorDe(0);
        setEstado({ cargando: false, error: null });
      })
      .catch(() => {
        if (!cancelado) setEstado({ cargando: false, error: 'No fue posible cargar la revista.' });
      });

    return () => {
      cancelado = true;
      libro.current = null;
      dejarDeVigilar();
      redibujar.current = () => {};
      try {
        flip?.destroy();
      } catch {
        /* page-flip ya liberado */
      }
      host.replaceChildren();
      tarea.destroy();
    };
  }, [url, intento, ajustes.tapaDura, ajustes.sombra, ajustes.duracionPaso]);

  useEffect(() => {
    const alCambiar = () =>
      setPantallaCompleta((actual) => (document.fullscreenElement === marco.current ? 'nativa' : actual === 'ventana' ? 'ventana' : null));
    document.addEventListener('fullscreenchange', alCambiar);
    return () => document.removeEventListener('fullscreenchange', alCambiar);
  }, []);

  // Al maximizar o restaurar cambia el tamaño del libro: page-flip se reacomoda y las páginas se dibujan de nuevo
  useEffect(() => {
    const id = requestAnimationFrame(() => redibujar.current());
    if (pantallaCompleta === 'ventana') {
      const previo = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        cancelAnimationFrame(id);
        document.body.style.overflow = previo;
      };
    }
    return () => cancelAnimationFrame(id);
  }, [pantallaCompleta]);

  // Al estirar la ventana o cambiar el zoom del navegador (densidad de píxeles) las páginas se vuelven a dibujar a la
  // nueva resolución; si no, el navegador agranda el dibujo anterior y se ve pixelado. Espera a que termine el cambio.
  useEffect(() => {
    const host = contenedor.current;
    if (!host || typeof ResizeObserver === 'undefined') return undefined;
    let ancho = 0;
    let densidad = window.devicePixelRatio || 1;
    let espera = 0;
    const observador = new ResizeObserver(([entrada]) => {
      const nuevo = entrada.contentRect.width;
      const nuevaDensidad = window.devicePixelRatio || 1;
      if (!ancho) {
        ancho = nuevo;
        return;
      }
      if (Math.abs(nuevo - ancho) / ancho < 0.1 && nuevaDensidad === densidad) return;
      clearTimeout(espera);
      espera = setTimeout(() => {
        ancho = nuevo;
        densidad = nuevaDensidad;
        redibujar.current();
      }, 250);
    });
    observador.observe(host);
    // El zoom del navegador cambia la densidad sin cambiar siempre el ancho del contenedor
    const consulta = window.matchMedia?.(`(resolution: ${densidad}dppx)`);
    const alCambiarDensidad = () => {
      densidad = window.devicePixelRatio || 1;
      redibujar.current();
    };
    consulta?.addEventListener?.('change', alCambiarDensidad);
    return () => {
      clearTimeout(espera);
      observador.disconnect();
      consulta?.removeEventListener?.('change', alCambiarDensidad);
    };
  }, []);

  // Efecto 3D: la página visible (la derecha en horizontal) se arranca del libro y vuelve a su sitio
  const arrancar = async (opciones) => {
    const flip = libro.current;
    if (!flip || arrancando) return;
    const izquierda = opciones?.izquierda === true;
    const actual = flip.getCurrentPageIndex();
    const hojas = hojasLibro.current;
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
    setArrancando(true);
    // Debajo de la hoja arrancada aparece la siguiente (o la anterior si se arranca la de la izquierda)
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
        // Con «reducir movimiento» solo parpadea: la página se oculta y vuelve
        ocultar();
        await new Promise((r) => setTimeout(r, 300));
        mostrar();
        return;
      }
      const { arrancarPagina } = await import('./revista/arrancarPagina.js');
      await arrancarPagina({
        lienzo,
        rect: lienzo.getBoundingClientRect(),
        lomoIzquierda,
        ocultar,
        mostrar,
        sonido: ajustes.sonidoPapel,
        capaPadre: document.fullscreenElement || document.body,
      });
    } catch {
      mostrar();
    } finally {
      setArrancando(false);
    }
  };

  arrancarRef.current = arrancar;

  const anterior = () => libro.current?.flipPrev();
  const siguiente = () => libro.current?.flipNext();
  const alPresionar = (e) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      anterior();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      siguiente();
    } else if (e.key === 'Escape' && pantallaCompleta === 'ventana') {
      setPantallaCompleta(null);
    }
  };
  const alternarPantallaCompleta = () => {
    if (pantallaCompleta === 'ventana') setPantallaCompleta(null);
    else if (document.fullscreenElement) document.exitFullscreen?.();
    else if (marco.current?.requestFullscreen) {
      marco.current.requestFullscreen().catch(() => setPantallaCompleta('ventana'));
    } else setPantallaCompleta('ventana');
    marco.current?.focus();
  };

  const listo = !estado.cargando && !estado.error;
  const paginasVisibles = vertical ? 1 : 2;

  return (
    <div
      ref={marco}
      className={`revista-libro ${pantallaCompleta ? 'revista-pantalla-completa' : ''}`}
      // Ancho máximo del libro por cada unidad de alto: una página en vertical, dos en horizontal
      style={{ '--revista-ancho-por-alto': (vertical ? 1 : 2) / proporcion }}
      role="region"
      aria-roledescription="libro"
      aria-label={titulo}
      tabIndex={0}
      onKeyDown={alPresionar}
    >
      {estado.cargando && (
        <div className="revista-estado">
          <Cargando texto="Cargando la revista…" />
        </div>
      )}
      {estado.error && (
        <div className="revista-estado" role="alert">
          <p className="mb-2">{estado.error}</p>
          <button type="button" className="btn btn-sm btn-outline-light" onClick={() => setIntento((n) => n + 1)}>
            Reintentar
          </button>
        </div>
      )}
      <div ref={contenedor} className="revista-hojas" aria-hidden={!listo} />
      {listo && (
        <div className="revista-controles">
          <button type="button" className="btn btn-revista" onClick={anterior} disabled={pagina === 0} aria-label="Página anterior">
            <i className="bi bi-chevron-left" aria-hidden="true"></i>
          </button>
          <span className="revista-indicador" aria-live="polite">{textoPaginas(pagina, total, vertical)}</span>
          <button
            type="button"
            className="btn btn-revista"
            onClick={siguiente}
            disabled={pagina + paginasVisibles >= total}
            aria-label="Página siguiente"
          >
            <i className="bi bi-chevron-right" aria-hidden="true"></i>
          </button>
          {(ajustes.permitirPantallaCompleta || ajustes.efectoArrancar || ajustes.permitirDescarga) && <span className="revista-separador" aria-hidden="true"></span>}
          {ajustes.permitirPantallaCompleta && <button type="button" className="btn btn-revista" onClick={alternarPantallaCompleta} aria-label={pantallaCompleta ? 'Salir de pantalla completa' : 'Ver en pantalla completa'}>
            <i className={`bi bi-${pantallaCompleta ? 'fullscreen-exit' : 'arrows-fullscreen'}`} aria-hidden="true"></i>
          </button>}
          {ajustes.efectoArrancar && <button type="button" className="btn btn-revista" onClick={() => arrancar()} disabled={arrancando} aria-label="Arrancar esta página (efecto: la página vuelve a su sitio)" title="Arrancar la página">
            <i className="bi bi-scissors" aria-hidden="true"></i>
          </button>}
          {ajustes.permitirDescarga && <a className="btn btn-revista" href={url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir el PDF de ${titulo} en una pestaña nueva`}>
            <i className="bi bi-file-earmark-pdf" aria-hidden="true"></i>
          </a>}
        </div>
      )}
    </div>
  );
}
