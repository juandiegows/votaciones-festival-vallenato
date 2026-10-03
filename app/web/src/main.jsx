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

// URL limpias (sin #). En GitHub Pages la base es /votaciones-festival-vallenato/ y 404.html
// (copia de index.html generada al compilar) atiende los enlaces profundos.
const basename = BASE_URL.replace(/\/+$/, '') || '/';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <AppProvider>
        <App />
      </AppProvider>
    </BrowserRouter>
  </StrictMode>
);
