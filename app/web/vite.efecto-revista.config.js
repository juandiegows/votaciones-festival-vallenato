// Empaqueta el efecto 3D de la revista (con Three.js) como módulo para el sitio Django (portal):
// npm run build:efecto-revista → app/api/portal/static/portal/js/arrancar-pagina.min.js
import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  build: {
    lib: { entry: 'src/components/revista/arrancarPagina.js', formats: ['es'], fileName: () => 'arrancar-pagina.min.js' },
    outDir: '../api/portal/static/portal/js',
    emptyOutDir: false,
    minify: true,
    copyPublicDir: false,
  },
});
