import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const reducirMovimiento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Carrusel del inicio (clases de Bootstrap, controlado por React). Rota cada 7 s salvo que el usuario
// prefiera menos movimiento, lo pause o esté interactuando con él.
export default function HeroBanners({ banners, titulo }) {
  const [actual, setActual] = useState(0);
  const [pausado, setPausado] = useState(reducirMovimiento);
  const [enFoco, setEnFoco] = useState(false);
  const total = banners.length;
  const indice = actual % total;

  useEffect(() => {
    if (pausado || enFoco || total < 2) return undefined;
    const t = setInterval(() => setActual((i) => (i + 1) % total), 7000);
    return () => clearInterval(t);
  }, [pausado, enFoco, total]);

  const ir = (i) => setActual((i + total) % total);

  return (
    <section
      className="carousel hero-banners"
      aria-roledescription="carrusel"
      aria-labelledby="titulo-hero"
      onMouseEnter={() => setEnFoco(true)}
      onMouseLeave={() => setEnFoco(false)}
      onFocus={() => setEnFoco(true)}
      onBlur={() => setEnFoco(false)}
    >
      <h1 id="titulo-hero" className="visually-hidden">{titulo}</h1>
      <div className="carousel-inner" aria-live={pausado || enFoco ? 'polite' : 'off'}>
        {banners.map((b, i) => (
          <div key={b.id} className={`carousel-item ${i === indice ? 'active' : ''}`} role="group" aria-roledescription="diapositiva" aria-label={`${i + 1} de ${total}`}>
            <img src={b.imagen} alt={b.textoAlternativo} className="hero-banner-img" />
            <div className="hero-banner-texto">
              <div className="container">
                <p className="h1 mb-2">{b.titulo}</p>
                {b.subtitulo && <p className="lead mb-3">{b.subtitulo}</p>}
                {b.textoBoton && b.enlaceBoton && (b.enlaceBoton.startsWith('/') ? (
                  <Link to={b.enlaceBoton} className="btn btn-primary btn-lg">{b.textoBoton}</Link>
                ) : (
                  <a href={b.enlaceBoton} className="btn btn-primary btn-lg" target="_blank" rel="noopener noreferrer">{b.textoBoton}</a>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      {total > 1 && (
        <>
          <button className="carousel-control-prev" type="button" onClick={() => ir(indice - 1)}>
            <span className="carousel-control-prev-icon" aria-hidden="true"></span>
            <span className="visually-hidden">Anterior</span>
          </button>
          <button className="carousel-control-next" type="button" onClick={() => ir(indice + 1)}>
            <span className="carousel-control-next-icon" aria-hidden="true"></span>
            <span className="visually-hidden">Siguiente</span>
          </button>
          <div className="carousel-indicators">
            {banners.map((b, i) => (
              <button key={b.id} type="button" className={i === indice ? 'active' : ''} aria-current={i === indice} aria-label={`Ir a la diapositiva ${i + 1}`} onClick={() => ir(i)}></button>
            ))}
          </div>
          <button type="button" className="btn btn-sm btn-dark hero-banner-pausa" onClick={() => setPausado((p) => !p)} aria-pressed={pausado}>
            <i className={`bi ${pausado ? 'bi-play-fill' : 'bi-pause-fill'}`} aria-hidden="true"></i>
            <span className="visually-hidden">{pausado ? 'Reanudar' : 'Pausar'} el carrusel</span>
          </button>
        </>
      )}
    </section>
  );
}
