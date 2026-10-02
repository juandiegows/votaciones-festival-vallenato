import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: ruta del repositorio en GitHub Pages
export default defineConfig({
  plugins: [react()],
  base: '/votaciones-festival-vallenato/',
});
