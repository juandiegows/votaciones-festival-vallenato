import { cpSync, createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Recursos de pdf.js que la revista necesita en tiempo de ejecución: decodificadores wasm (imágenes JPEG 2000
// y JBIG2), mapas de caracteres, fuentes estándar y perfiles de color. Se sirven en /pdfjs/… desde node_modules
// (en desarrollo) y se copian a dist/pdfjs (al compilar), sin versionar binarios en el repositorio.
const raiz = dirname(fileURLToPath(import.meta.url));
const PDFJS = join(raiz, 'node_modules', 'pdfjs-dist');
const CARPETAS_PDFJS = ['wasm', 'cmaps', 'standard_fonts', 'iccs'];
const TIPOS = { '.wasm': 'application/wasm', '.js': 'text/javascript', '.mjs': 'text/javascript' };

function recursosPdfjs() {
  let salida = 'dist';
  return {
    name: 'recursos-pdfjs',
    configResolved(config) {
      salida = resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = /\/pdfjs\/(wasm|cmaps|standard_fonts|iccs)\/([^?#]+)/.exec(req.url || '');
        if (!m) return next();
        const carpeta = join(PDFJS, m[1]);
        const archivo = normalize(join(carpeta, decodeURIComponent(m[2])));
        if (!archivo.startsWith(carpeta + sep) || !existsSync(archivo) || !statSync(archivo).isFile()) return next();
        const ext = archivo.slice(archivo.lastIndexOf('.'));
        res.setHeader('Content-Type', TIPOS[ext] || 'application/octet-stream');
        createReadStream(archivo).pipe(res);
      });
    },
    closeBundle() {
      CARPETAS_PDFJS.forEach((c) => cpSync(join(PDFJS, c), join(salida, 'pdfjs', c), { recursive: true }));
    },
  };
}

// Dominio canónico para canonical, Open Graph y JSON-LD (index.html usa %VITE_SITE_URL%): producción por defecto,
// también en la copia de GitHub Pages, para que los buscadores no la tomen como contenido duplicado.
process.env.VITE_SITE_URL = (process.env.VITE_SITE_URL || 'https://votaciones.juandiegows.com').replace(/\/+$/, '');

// base: GitHub Pages sirve el sitio en /votaciones-festival-vallenato/;
// la imagen Docker (VPS, votaciones.juandiegows.com) lo construye con VITE_BASE=/
export default defineConfig({
  plugins: [react(), recursosPdfjs()],
  base: process.env.VITE_BASE || '/votaciones-festival-vallenato/',
});
