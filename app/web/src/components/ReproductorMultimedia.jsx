import { useRef, useState } from 'react';
import { urlDelSitio } from '../config.js';

const EXT_AUDIO = /\.(mp3|ogg|wav|m4a|webm)(\?.*)?$/i;
const YOUTUBE = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i;
const SPOTIFY = /open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist|episode|show)\/([A-Za-z0-9]+)/i;
const SOUNDCLOUD = /^https?:\/\/(?:www\.|m\.)?soundcloud\.com\//i;

/** Clasifica un enlace multimedia: audio propio, video/audio embebido o enlace externo. */
export function analizarEnlace(enlace) {
  if (!enlace) return null;
  const relativo = enlace.startsWith('/') && !enlace.startsWith('//');
  const url = relativo ? urlDelSitio(enlace) : enlace;
  if (EXT_AUDIO.test(enlace)) return { tipo: 'audio', url, propio: relativo };
  const yt = YOUTUBE.exec(enlace);
  if (yt) return { tipo: 'embebido', proveedor: 'YouTube', url: `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1`, alto: 200 };
  const sp = SPOTIFY.exec(enlace);
  if (sp) return { tipo: 'embebido', proveedor: 'Spotify', url: `https://open.spotify.com/embed/${sp[1]}/${sp[2]}`, alto: 152 };
  if (SOUNDCLOUD.test(enlace)) {
    return {
      tipo: 'embebido',
      proveedor: 'SoundCloud',
      url: `https://w.soundcloud.com/player/?url=${encodeURIComponent(enlace)}&color=%23dd3333&auto_play=true`,
      alto: 166,
    };
  }
  return { tipo: 'enlace', url };
}

// Solo un audio suena a la vez: al iniciar uno se pausan los demás.
let escuchaRegistrada = false;
function registrarAudioUnico() {
  if (escuchaRegistrada || typeof document === 'undefined') return;
  escuchaRegistrada = true;
  document.addEventListener(
    'play',
    (e) => {
      if (!(e.target instanceof HTMLAudioElement)) return;
      document.querySelectorAll('audio').forEach((a) => a !== e.target && a.pause());
    },
    true
  );
}

/**
 * Origen del sonido de una opción, para que el administrador y el votante sepan de dónde sale:
 * archivo subido, muestra incluida en el sitio o enlace externo.
 */
export function fuenteMedio({ audio, enlace } = {}) {
  if (audio) return { tipo: 'subido', etiqueta: 'Archivo de audio subido', icono: 'file-earmark-music' };
  const medio = analizarEnlace(enlace);
  if (!medio) return null;
  if (medio.tipo === 'audio' && medio.propio) return { tipo: 'sitio', etiqueta: 'Muestra del sitio (ilustrativa)', icono: 'music-note' };
  if (medio.tipo === 'audio') return { tipo: 'externo', etiqueta: 'Enlace externo · archivo de audio', icono: 'link-45deg' };
  if (medio.tipo === 'embebido') return { tipo: 'externo', etiqueta: `Enlace externo · ${medio.proveedor}`, icono: 'box-arrow-up-right' };
  return { tipo: 'externo', etiqueta: 'Enlace externo', icono: 'box-arrow-up-right' };
}

function TextoAudio({ texto, titulo, abierto = false }) {
  if (!texto) return null;
  return (
    <details className="texto-audio mt-1" open={abierto || undefined}>
      <summary>Ver texto del audio</summary>
      <p className="mb-0 small" aria-label={`Texto del audio de «${titulo}»`}>{texto}</p>
    </details>
  );
}

const formatoTiempo = (s) => {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

/** Pista de audio con los colores del Festival: reproducir/pausar, barra para adelantar, tiempos y silencio. */
function PistaAudio({ url, etiqueta, titulo }) {
  const audio = useRef(null);
  const [sonando, setSonando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [actual, setActual] = useState(0);
  const [duracion, setDuracion] = useState(0);
  const [silencio, setSilencio] = useState(false);
  const [error, setError] = useState(false);
  const progreso = duracion ? (actual / duracion) * 100 : 0;

  const alternar = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) {
      setCargando(true);
      a.play().catch(() => setCargando(false));
    } else {
      a.pause();
    }
  };

  const buscar = (e) => {
    const a = audio.current;
    if (!a || !duracion) return;
    a.currentTime = Number(e.target.value);
    setActual(a.currentTime);
  };

  const alternarSilencio = () => {
    const a = audio.current;
    if (!a) return;
    a.muted = !a.muted;
    setSilencio(a.muted);
  };

  if (error) {
    return (
      <p className="small text-secondary-flv mb-0">
        <i className="bi bi-exclamation-circle me-1" aria-hidden="true"></i>No se pudo cargar el audio. <a href={url}>Descargar la muestra</a>
      </p>
    );
  }

  return (
    <div className={`pista-audio ${sonando ? 'sonando' : ''}`}>
      <audio
        ref={audio}
        src={url}
        preload="metadata"
        onLoadedMetadata={(e) => setDuracion(e.currentTarget.duration)}
        onDurationChange={(e) => setDuracion(e.currentTarget.duration)}
        onTimeUpdate={(e) => setActual(e.currentTarget.currentTime)}
        onPlaying={() => { setSonando(true); setCargando(false); }}
        onPause={() => setSonando(false)}
        onEnded={() => { setSonando(false); setActual(0); }}
        onWaiting={() => setCargando(true)}
        onError={() => setError(true)}
      >
        <a href={url}>Descargar la muestra de «{titulo}»</a>
      </audio>
      <button type="button" className="pista-boton" onClick={alternar} aria-label={`${sonando ? 'Pausar' : 'Reproducir'} muestra de «${titulo}»`}>
        {cargando && !sonando ? (
          <span className="spinner-border spinner-border-sm" aria-hidden="true"></span>
        ) : (
          <i className={`bi bi-${sonando ? 'pause-fill' : 'play-fill'}`} aria-hidden="true"></i>
        )}
      </button>
      <span className="pista-ecualizador" aria-hidden="true"><span></span><span></span><span></span></span>
      <input
        type="range"
        className="pista-barra"
        min="0"
        max={duracion || 0}
        step="0.1"
        value={Math.min(actual, duracion || 0)}
        onChange={buscar}
        disabled={!duracion}
        style={{ '--progreso': `${progreso}%` }}
        aria-label={`Posición: ${etiqueta}`}
        aria-valuetext={`${formatoTiempo(actual)} de ${formatoTiempo(duracion)}`}
      />
      <span className="pista-tiempo" aria-hidden="true">{formatoTiempo(actual)} / {formatoTiempo(duracion)}</span>
      <button type="button" className="pista-silencio" onClick={alternarSilencio} aria-pressed={silencio} aria-label={silencio ? 'Activar sonido' : 'Silenciar'}>
        <i className={`bi bi-${silencio ? 'volume-mute-fill' : 'volume-up-fill'}`} aria-hidden="true"></i>
      </button>
    </div>
  );
}

/**
 * Reproductor de la muestra multimedia de una opción.
 * - `audio` (archivo subido por el administrador) tiene prioridad sobre `enlace`.
 * - .mp3/.ogg/.wav/.m4a/.webm → PistaAudio (reproductor propio con la marca; al cargar solo pide los metadatos).
 * - YouTube, Spotify, SoundCloud → reproductor embebido que se carga solo al pulsar «Escuchar».
 * - Otro enlace → «Abrir enlace» en una pestaña nueva.
 * - `textoAudio` (letra o descripción) se ofrece en un desplegable para quien no puede escuchar.
 */
export default function ReproductorMultimedia({ enlace, audio, textoAudio, titulo, className = '', mostrarFuente = false, textoAbierto = false }) {
  const [embebidoActivo, setEmbebidoActivo] = useState(false);
  const medio = audio ? { tipo: 'audio', url: audio, subido: true } : analizarEnlace(enlace);
  if (!medio) {
    return textoAudio ? <div className={`reproductor ${className}`}><TextoAudio texto={textoAudio} titulo={titulo} abierto={textoAbierto} /></div> : null;
  }
  const etiqueta = `Escuchar muestra de «${titulo}»`;
  const fuente = mostrarFuente ? fuenteMedio({ audio, enlace }) : null;
  const notaFuente = fuente && (
    <p className="reproductor-nota mb-0"><i className={`bi bi-${fuente.icono} me-1`} aria-hidden="true"></i>{fuente.etiqueta}</p>
  );

  if (medio.tipo === 'audio') {
    registrarAudioUnico();
    return (
      <div className={`reproductor ${className}`}>
        <PistaAudio url={medio.url} etiqueta={etiqueta} titulo={titulo} />
        {notaFuente || (medio.propio && (
          <p className="reproductor-nota mb-0">
            <i className="bi bi-music-note me-1" aria-hidden="true"></i>Muestra instrumental generada (ilustrativa)
          </p>
        ))}
        <TextoAudio texto={textoAudio} titulo={titulo} abierto={textoAbierto} />
      </div>
    );
  }

  if (medio.tipo === 'embebido') {
    return (
      <div className={`reproductor ${className}`}>
        {embebidoActivo ? (
          <iframe
            src={medio.url}
            title={`Muestra de «${titulo}» en ${medio.proveedor}`}
            width="100%"
            height={medio.alto}
            loading="lazy"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="reproductor-embebido"
          ></iframe>
        ) : (
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setEmbebidoActivo(true)} aria-label={`${etiqueta} (${medio.proveedor})`}>
            <i className="bi bi-play-circle me-1" aria-hidden="true"></i>Escuchar <span className="small">· {medio.proveedor}</span>
          </button>
        )}
        <p className="reproductor-nota mb-0">Contenido externo de {medio.proveedor}; se carga solo si pulsas «Escuchar».</p>
        <TextoAudio texto={textoAudio} titulo={titulo} abierto={textoAbierto} />
      </div>
    );
  }

  return (
    <div className={`reproductor ${className}`}>
      <a href={medio.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-primary" aria-label={`Abrir enlace de «${titulo}» (se abre en una pestaña nueva)`}>
        <i className="bi bi-box-arrow-up-right me-1" aria-hidden="true"></i>Abrir enlace
      </a>
      {notaFuente}
      <TextoAudio texto={textoAudio} titulo={titulo} abierto={textoAbierto} />
    </div>
  );
}
