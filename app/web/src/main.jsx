import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './styles/brand.css';
import './styles.css';
import './styles/admin-analisis.css';
import App from './App.jsx';
import { AppProvider } from './context/AppContext.jsx';
import { BASE_URL } from './config.js';
import LimiteErrores from './components/LimiteErrores.jsx';
import { instalarRegistroErrores } from './api/registroErrores.js';

// Errores de JavaScript sin atrapar (window.onerror y promesas rechazadas) → registros del sistema (con la API)
instalarRegistroErrores();

// URL limpias (sin #). En GitHub Pages la base es /votaciones-festival-vallenato/ y 404.html
// (copia de index.html generada al compilar) atiende los enlaces profundos.
const basename = BASE_URL.replace(/\/+$/, '') || '/';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      {/* ErrorBoundary global: si falla algo fuera de una pantalla (navbar, proveedores de datos), página 500 */}
      <LimiteErrores independiente>
        <AppProvider>
          <App />
        </AppProvider>
      </LimiteErrores>
    </BrowserRouter>
  </StrictMode>
);
