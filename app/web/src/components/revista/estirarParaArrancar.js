/**
 * «Estirar para arrancar»: mientras se arrastra la esquina de una página (estado user_fold de page-flip), si el
 * puntero sale del libro más allá de un margen, se suelta el doblez y se avisa para arrancar esa página.
 * Se comparte con el sitio Django (portal/static/portal/js/revista-libro.js tiene la misma lógica).
 */

const ATRAS = 1; // FlipDirection.BACK de page-flip

/** Deja el libro plano y quieto, sin terminar el paso de página que se estaba arrastrando. */
export function soltarDoblez(flip) {
  try {
    // page-flip no expone una forma pública de cancelar el arrastre: se replica el final de su animación
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
}

/**
 * Vigila el arrastre. `alArrancar({ izquierda })` recibe qué página se estaba pasando (la de la izquierda si se
 * arrastraba hacia atrás). Devuelve la función para dejar de vigilar.
 */
export function vigilarEstiramiento({ flip, contenedor, activo, alArrancar }) {
  let plegando = false;
  flip.on('changeState', (e) => {
    plegando = e.data === 'user_fold';
  });
  const alMover = (evento) => {
    if (!plegando || !activo()) return;
    const punto = evento.touches?.[0] || evento;
    const r = contenedor.getBoundingClientRect();
    const margen = Math.max(40, r.width * 0.08);
    const fuera = punto.clientX < r.left - margen || punto.clientX > r.right + margen
      || punto.clientY < r.top - margen || punto.clientY > r.bottom + margen;
    if (!fuera) return;
    plegando = false;
    const izquierda = flip.getFlipController().getCalculation()?.getDirection() === ATRAS;
    soltarDoblez(flip);
    alArrancar({ izquierda });
  };
  window.addEventListener('mousemove', alMover);
  window.addEventListener('touchmove', alMover, { passive: true });
  return () => {
    window.removeEventListener('mousemove', alMover);
    window.removeEventListener('touchmove', alMover);
  };
}
