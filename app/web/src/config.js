// Configuración de compilación.
// VITE_API_URL sin definir → modo demostración (datos simulados en localStorage, p. ej. GitHub Pages).
// VITE_API_URL definida (p. ej. /api o http://localhost:8096/api) → modo API (Django REST).
export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
export const MODO_API = API_URL !== '';

// Base pública del sitio (Vite `base`): «/» en la VPS/Docker, «/votaciones-festival-vallenato/» en GitHub Pages.
export const BASE_URL = import.meta.env.BASE_URL || '/';

/** Convierte una ruta del sitio («/audio/x.mp3») en una URL que respeta la base pública. */
export function urlDelSitio(ruta) {
  return `${BASE_URL.replace(/\/+$/, '')}${ruta}`;
}
