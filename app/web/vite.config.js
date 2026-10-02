import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: GitHub Pages sirve el sitio en /votaciones-festival-vallenato/;
// la imagen Docker (VPS, votaciones.juandiegows.com) lo construye con VITE_BASE=/
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/votaciones-festival-vallenato/',
});
