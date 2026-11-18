/**
 * Efecto 3D «arrancar la página» de la revista (Three.js, se carga solo al usarlo).
 *
 * La página (el lienzo que dibujó pdf.js) se convierte en una malla de papel:
 *  1. se rasga por un borde irregular cerca del lomo: un jirón queda pegado al libro;
 *  2. el resto se curva al tirar de él, se suelta, gira y cae ondeando con gravedad;
 *  3. saltan fibras de papel desde la rotura y al final la página vuelve a su sitio (es solo un efecto).
 * El rasgado, la curvatura, el ondeo y el sombreado se calculan en los shaders; la trayectoria, en JavaScript.
 */
import {
  AdditiveBlending, BufferAttribute, DoubleSide, BufferGeometry, CanvasTexture, Mesh, PerspectiveCamera, PlaneGeometry, Points,
  Scene, ShaderMaterial, SRGBColorSpace, WebGLRenderer,
} from 'three';

const DURACION = 2.8; // segundos
const FIBRAS = 140;

// Borde de la rotura (en u, 0 = lomo) para una altura v; el mismo cálculo en GLSL y en JavaScript
const GLSL_BORDE = /* glsl */ `
  uniform float uSemilla;
  float azar(float x) { return fract(sin(x * 127.1 + uSemilla) * 43758.5453); }
  float ruido(float x) {
    float i = floor(x); float f = fract(x);
    return mix(azar(i), azar(i + 1.0), f * f * (3.0 - 2.0 * f));
  }
  float borde(float v) {
    return 0.085 + 0.035 * sin(v * 5.0 + uSemilla) + 0.03 * ruido(v * 18.0) + 0.012 * ruido(v * 90.0);
  }
`;

function bordeJs(v, semilla) {
  const azar = (x) => {
    const s = Math.sin(x * 127.1 + semilla) * 43758.5453;
    return s - Math.floor(s);
  };
  const ruido = (x) => {
    const i = Math.floor(x);
    const f = x - i;
    return azar(i) + (azar(i + 1) - azar(i)) * f * f * (3 - 2 * f);
  };
  return 0.085 + 0.035 * Math.sin(v * 5 + semilla) + 0.03 * ruido(v * 18) + 0.012 * ruido(v * 90);
}

const VERTICE = /* glsl */ `
  ${GLSL_BORDE}
  uniform float uPelar;    // 0..1: cuánto se curva al tirar
  uniform float uOndear;   // 0..1: ondeo en el aire
  uniform float uTiempo;
  uniform float uAncho;
  uniform float uAlto;
  uniform float uEsJiron;  // 1 = parte que queda pegada al lomo
  uniform float uLado;     // 1 = lomo a la izquierda, -1 = a la derecha
  varying vec2 vUv;
  varying float vLuz;
  void main() {
    vUv = uv;
    float u = uLado > 0.0 ? uv.x : 1.0 - uv.x;          // distancia al lomo (0..1)
    vec3 p = position;
    if (uEsJiron < 0.5) {
      // La geometría tiene el origen en el eje de la rotura: d = distancia a ese eje hacia el borde exterior
      float d = uLado * p.x;
      float esquina = 1.0 + 0.6 * uv.y;                   // tira más desde la esquina superior
      float k = uPelar * esquina * 0.85 / uAncho;          // curvatura del cilindro sobre el que se enrolla
      float a = 0.0;
      if (k > 0.00001 && d > 0.0) {
        a = k * d;
        p.x = uLado * sin(a) / k;
        p.z += (1.0 - cos(a)) / k;
      }
      // Ondeo en el aire, como una hoja que cae
      float onda = sin(uv.x * 7.0 + uTiempo * 9.0);
      p.z += uOndear * (onda * 18.0 + sin(uv.y * 5.0 + uTiempo * 6.0) * 12.0) * (0.3 + u);
      vLuz = 1.0 - 0.4 * clamp(sin(a) + uOndear * 0.35 * onda, -0.3, 1.0);
    } else {
      vLuz = 1.0;
    }
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FRAGMENTO = /* glsl */ `
  ${GLSL_BORDE}
  uniform sampler2D uMapa;
  uniform float uEsJiron;
  uniform float uLado;
  uniform float uOpacidad;
  varying vec2 vUv;
  varying float vLuz;
  void main() {
    float u = uLado > 0.0 ? vUv.x : 1.0 - vUv.x;
    float b = borde(vUv.y);
    float lado = uEsJiron > 0.5 ? b - u : u - b;          // > 0 dentro de la pieza
    if (lado < 0.0) discard;
    vec4 color = texture2D(uMapa, vUv);
    // Fibras blancas del papel en el borde rasgado
    float fibra = 1.0 - smoothstep(0.0, 0.006 + 0.004 * fract(sin(vUv.y * 900.0) * 43758.0), lado);
    color.rgb = mix(color.rgb, vec3(0.97, 0.95, 0.9), fibra * 0.9);
    // Reverso de la hoja: papel liso y algo más oscuro
    if (!gl_FrontFacing) color.rgb = vec3(0.93, 0.91, 0.87);
    gl_FragColor = vec4(color.rgb * vLuz, color.a * uOpacidad);
  }
`;

const VERTICE_FIBRAS = /* glsl */ `
  attribute float aTam;
  attribute float aVida;
  uniform float uTiempo;
  varying float vAlfa;
  void main() {
    vAlfa = clamp(1.0 - uTiempo / aVida, 0.0, 1.0);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aTam;
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENTO_FIBRAS = /* glsl */ `
  varying float vAlfa;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    if (dot(c, c) > 0.25) discard;
    gl_FragColor = vec4(0.96, 0.93, 0.86, vAlfa * 0.9);
  }
`;

/** Sonido de papel rasgado sintetizado (ruido filtrado con crujidos); sin archivos ni derechos de autor. */
function sonarRasgado() {
  const Contexto = window.AudioContext || window.webkitAudioContext;
  if (!Contexto) return;
  try {
    const ctx = new Contexto();
    const duracion = 0.7;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duracion), ctx.sampleRate);
    const datos = buffer.getChannelData(0);
    let crujido = 0;
    for (let i = 0; i < datos.length; i++) {
      if (Math.random() < 0.004) crujido = 1;
      crujido *= 0.995;
      const t = i / datos.length;
      datos[i] = (Math.random() * 2 - 1) * (0.25 + crujido) * Math.min(1, t * 12) * (1 - t) ** 1.5;
    }
    const fuente = ctx.createBufferSource();
    fuente.buffer = buffer;
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.frequency.value = 2600;
    filtro.Q.value = 0.7;
    const volumen = ctx.createGain();
    volumen.gain.value = 0.35;
    fuente.connect(filtro).connect(volumen).connect(ctx.destination);
    fuente.start();
    fuente.onended = () => ctx.close();
  } catch {
    /* sin audio: el efecto sigue */
  }
}

const suave = (t) => t * t * (3 - 2 * t);

/**
 * Arranca la página dibujada en `lienzo`, que se ve en pantalla en el rectángulo `rect`.
 * `lomoIzquierda`: lado del lomo. `ocultar`/`mostrar`: esconden y devuelven la página real del libro.
 * Devuelve una promesa que se resuelve al terminar.
 */
export function arrancarPagina({ lienzo, rect, lomoIzquierda = true, ocultar, mostrar, sonido = true, capaPadre = document.body }) {
  return new Promise((resolver) => {
    const anchoV = window.innerWidth;
    const altoV = window.innerHeight;
    const renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(anchoV, altoV);
    renderer.setClearColor(0x000000, 0);
    const capa = renderer.domElement;
    capa.className = 'revista-capa-efecto';
    capa.setAttribute('aria-hidden', 'true');
    // En pantalla completa nativa solo se ve el elemento maximizado: la capa va dentro de él
    capaPadre.appendChild(capa);

    // Cámara en perspectiva donde 1 unidad = 1 píxel en z = 0 (la página coincide con la real)
    const fov = 35;
    const distancia = altoV / 2 / Math.tan((fov * Math.PI) / 360);
    const camara = new PerspectiveCamera(fov, anchoV / altoV, 1, distancia * 4);
    camara.position.set(0, 0, distancia);
    const escena = new Scene();

    const textura = new CanvasTexture(lienzo);
    textura.colorSpace = SRGBColorSpace;
    textura.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const lado = lomoIzquierda ? 1 : -1;
    const semilla = Math.random() * 100;
    const { width: w, height: h } = rect;
    // Centro de la página en coordenadas de la escena (y hacia arriba)
    const cx = rect.left + w / 2 - anchoV / 2;
    const cy = altoV / 2 - (rect.top + h / 2);
    // Eje de la rotura (aprox.): de ahí cuelga la pieza que se arranca
    const ejeU = 0.1;
    const ejeX = cx - lado * w / 2 + lado * ejeU * w;

    const uniformes = (esJiron) => ({
      uMapa: { value: textura }, uSemilla: { value: semilla }, uPelar: { value: 0 }, uOndear: { value: 0 },
      uTiempo: { value: 0 }, uAncho: { value: w }, uAlto: { value: h }, uEsJiron: { value: esJiron },
      uLado: { value: lado }, uOpacidad: { value: 1 },
    });
    const material = (esJiron) => new ShaderMaterial({
      uniforms: uniformes(esJiron), vertexShader: VERTICE, fragmentShader: FRAGMENTO, transparent: true, side: DoubleSide,
    });

    // Pieza que se arranca: geometría con el origen en el eje de la rotura para girarla desde ahí
    const geoPieza = new PlaneGeometry(w, h, 90, 60);
    geoPieza.translate(lado * (w / 2 - ejeU * w), 0, 0);
    const pieza = new Mesh(geoPieza, material(0));
    pieza.position.set(ejeX, cy, 0);
    const jiron = new Mesh(new PlaneGeometry(w, h, 1, 1), material(1));
    jiron.position.set(cx, cy, 0);
    escena.add(jiron, pieza);

    // Fibras que saltan desde la rotura
    const posiciones = new Float32Array(FIBRAS * 3);
    const velocidades = [];
    const tamanos = new Float32Array(FIBRAS);
    const vidas = new Float32Array(FIBRAS);
    for (let i = 0; i < FIBRAS; i++) {
      const v = Math.random();
      const u = bordeJs(v, semilla);
      posiciones[i * 3] = cx - lado * w / 2 + lado * u * w;
      posiciones[i * 3 + 1] = cy - h / 2 + v * h;
      posiciones[i * 3 + 2] = 2;
      velocidades.push([lado * (40 + Math.random() * 160), 60 + Math.random() * 220, 80 + Math.random() * 200]);
      tamanos[i] = (1.5 + Math.random() * 3.5) * renderer.getPixelRatio();
      vidas[i] = 0.6 + Math.random() * 1.1;
    }
    const geoFibras = new BufferGeometry();
    geoFibras.setAttribute('position', new BufferAttribute(posiciones, 3));
    geoFibras.setAttribute('aTam', new BufferAttribute(tamanos, 1));
    geoFibras.setAttribute('aVida', new BufferAttribute(vidas, 1));
    const matFibras = new ShaderMaterial({
      uniforms: { uTiempo: { value: 0 } }, vertexShader: VERTICE_FIBRAS, fragmentShader: FRAGMENTO_FIBRAS,
      transparent: true, depthWrite: false, blending: AdditiveBlending,
    });
    const fibras = new Points(geoFibras, matFibras);
    fibras.visible = false;
    escena.add(fibras);

    ocultar?.();
    if (sonido) setTimeout(sonarRasgado, 380);

    const inicio = performance.now();
    let sonoSuelta = false;
    let marco = 0;
    const paso = (ahora) => {
      const t = (ahora - inicio) / 1000;
      const up = pieza.material.uniforms;
      up.uTiempo.value = t;
      // 0–0.45 s: se curva al tirar; 0.45 s: se suelta; después vuela y cae ondeando
      const pelar = suave(Math.min(t / 0.45, 1));
      up.uPelar.value = pelar * 0.9;
      const s = Math.max(t - 0.45, 0);
      if (s > 0) {
        if (!sonoSuelta) {
          sonoSuelta = true;
          fibras.visible = true;
        }
        up.uOndear.value = Math.min(s / 0.4, 1);
        // Primero sube hacia quien mira, luego cae ondeando y se desvanece
        pieza.position.x = ejeX + lado * (140 * s + 40 * s * s);
        pieza.position.y = cy + 200 * s - 380 * s * s;
        pieza.position.z = 220 * s;
        pieza.rotation.y = -lado * (0.22 * s + 0.18 * Math.sin(s * 2.5));
        pieza.rotation.z = -lado * 0.35 * s;
        pieza.rotation.x = 0.2 * Math.sin(s * 3);
        up.uOpacidad.value = 1 - suave(Math.min(Math.max((s - 1.5) / 0.7, 0), 1));
        // Fibras con gravedad
        const st = s;
        for (let i = 0; i < FIBRAS; i++) {
          const [vx, vy, vz] = velocidades[i];
          posiciones[i * 3] += vx * 0.016;
          posiciones[i * 3 + 1] += (vy - 900 * st) * 0.016;
          posiciones[i * 3 + 2] += vz * 0.016;
        }
        geoFibras.attributes.position.needsUpdate = true;
        matFibras.uniforms.uTiempo.value = s;
      }
      // El jirón se desvanece al final mientras la página vuelve
      jiron.material.uniforms.uOpacidad.value = 1 - suave(Math.min(Math.max((t - 2.2) / 0.5, 0), 1));
      if (t > 2.2 && mostrar) {
        mostrar();
        mostrar = null;
      }
      renderer.render(escena, camara);
      if (t < DURACION) marco = requestAnimationFrame(paso);
      else terminar();
    };
    const terminar = () => {
      cancelAnimationFrame(marco);
      mostrar?.();
      for (const objeto of [pieza, jiron, fibras]) {
        objeto.geometry.dispose();
        objeto.material.dispose();
      }
      textura.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      capa.remove();
      resolver();
    };
    marco = requestAnimationFrame(paso);
  });
}
