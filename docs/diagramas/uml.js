// Utilidades para dibujar los diagramas UML y ER con HTML + SVG (se abren en el navegador y se exportan a PNG).
// Cada página tiene un #lienzo (position: relative) con un <svg id="trazos"> y las cajas como <div> absolutos.
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const NEGRO = '#141414';
  const lienzo = () => document.getElementById('lienzo');
  const svg = () => document.getElementById('trazos');

  function caja(id) {
    const r = lienzo().getBoundingClientRect(), b = document.getElementById(id).getBoundingClientRect();
    return { l: b.left - r.left, t: b.top - r.top, r: b.right - r.left, b: b.bottom - r.top,
             cx: (b.left + b.right) / 2 - r.left, cy: (b.top + b.bottom) / 2 - r.top, w: b.width, h: b.height };
  }

  function el(tag, attrs, padre) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    (padre || svg()).appendChild(e);
    return e;
  }

  function linea(pts, { discontinua = false, color = NEGRO, ancho = 2 } = {}) {
    el('path', { d: 'M' + pts.map(p => p.join(',')).join(' L'), fill: 'none', stroke: color, 'stroke-width': ancho,
                 'stroke-linejoin': 'round', ...(discontinua ? { 'stroke-dasharray': '8 6' } : {}) });
  }

  // Remate en el punto (x, y); (dx, dy) apunta desde la caja hacia afuera, a lo largo de la línea.
  function remate(x, y, dx, dy, tipo) {
    const px = -dy, py = dx, P = (a, b) => [x + dx * a + px * b, y + dy * a + py * b];
    const poli = (pts, relleno) => el('polygon', { points: pts.map(p => p.join(',')).join(' '), fill: relleno, stroke: NEGRO, 'stroke-width': 2, 'stroke-linejoin': 'round' });
    const raya = a => { const [x1, y1] = P(a, -9), [x2, y2] = P(a, 9); el('line', { x1, y1, x2, y2, stroke: NEGRO, 'stroke-width': 2 }); };
    const circ = a => { const [cx, cy] = P(a, 0); el('circle', { cx, cy, r: 5.5, fill: '#fff', stroke: NEGRO, 'stroke-width': 2 }); };
    const pata = () => { const [a1, a2] = P(0, -10), [b1, b2] = P(0, 10), [o1, o2] = P(16, 0);
      el('line', { x1: a1, y1: a2, x2: o1, y2: o2, stroke: NEGRO, 'stroke-width': 2 });
      el('line', { x1: b1, y1: b2, x2: o1, y2: o2, stroke: NEGRO, 'stroke-width': 2 }); };
    switch (tipo) {
      case 'herencia': poli([P(0, 0), P(18, -11), P(18, 11)], '#fff'); break;          // generalización UML
      case 'composicion': poli([P(0, 0), P(12, -8), P(24, 0), P(12, 8)], NEGRO); break;  // composición UML
      case 'flecha': { const [a, b] = [P(14, -8), P(14, 8)];
        el('polyline', { points: `${a.join(',')} ${x},${y} ${b.join(',')}`, fill: 'none', stroke: NEGRO, 'stroke-width': 2 }); break; }
      case 'uno': raya(10); raya(16); break;                                                // pata de gallo (ER)
      case 'cero-uno': raya(10); circ(24); break;
      case 'muchos-uno': pata(); raya(22); break;
      case 'muchos-cero': pata(); circ(28); break;
    }
  }

  function texto(x, y, t, clase = 'etq') {
    const d = document.createElement('div');
    d.className = clase; d.innerHTML = t; d.style.left = x + 'px'; d.style.top = y + 'px';
    lienzo().appendChild(d);
    return d;
  }

  const dir = (a, b) => { const dx = Math.sign(b[0] - a[0]), dy = Math.sign(b[1] - a[1]); return [dx, dy]; };

  // Conector con remates y multiplicidades. opciones: {ini, fin, multIni, multFin, nombre, nombreEn, discontinua}
  function conector(pts, o = {}) {
    linea(pts, o);
    const n = pts.length;
    const [di0, di1] = dir(pts[1], pts[0]);          // hacia afuera de la caja de inicio
    const [df0, df1] = dir(pts[n - 2], pts[n - 1]);  // hacia afuera de la caja final
    if (o.ini) remate(pts[0][0], pts[0][1], -di0, -di1, o.ini);
    if (o.fin) remate(pts[n - 1][0], pts[n - 1][1], -df0, -df1, o.fin);
    // lado: la multiplicidad inicial va debajo (o a la derecha) y la final encima, para que no se tapen
    const mult = (p, d, t, lado) => {
      const [dx, dy] = [-d[0], -d[1]];
      const x = p[0] + dx * 26 + (dy ? 18 : 0), y = p[1] + dy * 26 + (dx ? 16 * lado : 0);
      texto(x, y, t, 'mult');
    };
    if (o.multIni) mult(pts[0], [di0, di1], o.multIni, 1);
    if (o.multFin) mult(pts[n - 1], [df0, df1], o.multFin, -1);
    if (o.nombre) {
      const i = o.nombreEn ?? Math.floor((n - 1) / 2);
      const [a, b] = [pts[i], pts[i + 1]];
      texto((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, o.nombre, 'rel');
    }
  }

  // Nodo UML en 3D (cara superior y derecha) detrás del <div id>.
  function nodo3d(id, prof = 16, relleno = '#ECE7DF') {
    const c = caja(id);
    const g = el('g', {});
    svg().insertBefore(g, svg().firstChild);
    const pol = (pts) => el('polygon', { points: pts.map(p => p.join(',')).join(' '), fill: relleno, stroke: NEGRO, 'stroke-width': 2, 'stroke-linejoin': 'round' }, g);
    pol([[c.l, c.t], [c.l + prof, c.t - prof], [c.r + prof, c.t - prof], [c.r, c.t]]);
    pol([[c.r, c.t], [c.r + prof, c.t - prof], [c.r + prof, c.b - prof], [c.r, c.b]]);
  }

  window.UML = { caja, linea, remate, texto, conector, nodo3d };
})();
