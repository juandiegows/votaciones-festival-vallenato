import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SITIO_URL } from '../config.js';

// Valores por defecto: los mismos de index.html (los ve quien no ejecuta JavaScript)
export const SEO_BASE = {
  titulo: 'Votaciones · Festival de la Leyenda Vallenata',
  descripcion:
    'Vota por tus favoritos del Festival de la Leyenda Vallenata: canciones, piloneras, vestuario, agrupaciones y más. Regístrate, elige y recibe tu comprobante.',
  imagen: `${SITIO_URL}/og-image.png`,
};
const SUFIJO = ' · Votaciones FLV';
const MAX_DESCRIPCION = 160;

function fijarMeta(atributo, clave, valor) {
  let etiqueta = document.head.querySelector(`meta[${atributo}="${clave}"]`);
  if (!etiqueta) {
    etiqueta = document.createElement('meta');
    etiqueta.setAttribute(atributo, clave);
    document.head.appendChild(etiqueta);
  }
  etiqueta.setAttribute('content', valor);
}

function fijarCanonica(href) {
  if (!href) {
    document.head.querySelector('link[rel="canonical"]')?.remove();
    return;
  }
  let enlace = document.head.querySelector('link[rel="canonical"]');
  if (!enlace) {
    enlace = document.createElement('link');
    enlace.rel = 'canonical';
    document.head.appendChild(enlace);
  }
  enlace.href = href;
}

function fijarJsonLd(datos) {
  document.getElementById('seo-jsonld-pagina')?.remove();
  if (!datos) return;
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.id = 'seo-jsonld-pagina';
  script.textContent = JSON.stringify(datos);
  document.head.appendChild(script);
}

/** Texto plano de una sola línea, recortado al largo que muestran los buscadores. */
export function resumir(texto, max = MAX_DESCRIPCION) {
  const limpio = String(texto || '').replace(/\s+/g, ' ').trim();
  if (limpio.length <= max) return limpio;
  return `${limpio.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;
}

/** URL absoluta y canónica de una ruta del sitio (siempre en el dominio de producción, sin barra final). */
export const urlCanonica = (ruta) => `${SITIO_URL}${ruta === '/' ? '/' : ruta.replace(/\/+$/, '')}`;

/** JSON-LD BreadcrumbList a partir de [[nombre, ruta], …]. */
export const migasJsonLd = (migas) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: migas.map(([nombre, ruta], i) => ({ '@type': 'ListItem', position: i + 1, name: nombre, item: urlCanonica(ruta) })),
});

function aplicar({ titulo, descripcion, indexar, url, jsonLd }) {
  document.title = titulo;
  fijarMeta('name', 'description', descripcion);
  fijarMeta('name', 'robots', indexar ? 'index, follow, max-image-preview:large' : 'noindex, nofollow');
  fijarMeta('property', 'og:title', titulo);
  fijarMeta('property', 'og:description', descripcion);
  fijarMeta('property', 'og:url', url || urlCanonica('/'));
  fijarMeta('name', 'twitter:title', titulo);
  fijarMeta('name', 'twitter:description', descripcion);
  fijarCanonica(url);
  fijarJsonLd(jsonLd);
}

/**
 * Título, descripción, robots, canonical, Open Graph y JSON-LD de la página actual (la web es una SPA).
 * `null` no toca nada: lo usan las páginas que delegan en un hijo (p. ej. un 404 que pinta PaginaError).
 * Al salir de la página se restauran los valores por defecto.
 */
export function useSeo(opciones) {
  const { pathname } = useLocation();
  const activo = Boolean(opciones);
  const { titulo, descripcion, indexar = true, jsonLd } = opciones || {};
  const jsonLdTexto = jsonLd ? JSON.stringify(jsonLd) : '';

  useEffect(() => {
    if (!activo) return undefined;
    aplicar({
      titulo: titulo ? `${titulo}${SUFIJO}` : SEO_BASE.titulo,
      descripcion: resumir(descripcion || SEO_BASE.descripcion),
      indexar,
      // noindex + canonical son señales contradictorias: las páginas privadas no declaran canonical
      url: indexar ? urlCanonica(pathname) : null,
      jsonLd: jsonLdTexto ? JSON.parse(jsonLdTexto) : null,
    });
    // Sin canonical hasta que la página siguiente declare la suya
    return () => aplicar({ ...SEO_BASE, indexar: true, url: null, jsonLd: null });
  }, [activo, titulo, descripcion, indexar, pathname, jsonLdTexto]);
}
