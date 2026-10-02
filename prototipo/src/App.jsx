import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { RequiereAdmin, RequiereSesion } from './components/Guards.jsx';
import Inicio from './pages/Inicio.jsx';
import Registro from './pages/Registro.jsx';
import Login from './pages/Login.jsx';
import Categorias from './pages/Categorias.jsx';
import CategoriaVotaciones from './pages/CategoriaVotaciones.jsx';
import VotacionDetalle from './pages/VotacionDetalle.jsx';
import Comprobante from './pages/Comprobante.jsx';
import MisVotos from './pages/MisVotos.jsx';
import NoEncontrado from './pages/NoEncontrado.jsx';
import Marca from './pages/Marca.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminPanel from './pages/admin/AdminPanel.jsx';
import AdminCategorias from './pages/admin/AdminCategorias.jsx';
import AdminVotaciones from './pages/admin/AdminVotaciones.jsx';
import AdminOpciones from './pages/admin/AdminOpciones.jsx';
import AdminResultados from './pages/admin/AdminResultados.jsx';
import AdminEdiciones from './pages/admin/AdminEdiciones.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Público */}
        <Route index element={<Inicio />} />
        <Route path="registro" element={<Registro />} />
        <Route path="login" element={<Login />} />
        <Route path="categorias" element={<Categorias />} />
        <Route path="categorias/:id" element={<CategoriaVotaciones />} />
        <Route path="votaciones/:id" element={<VotacionDetalle />} />
        <Route path="marca" element={<Marca />} />
        {/* Votante autenticado */}
        <Route path="votaciones/:id/comprobante" element={<RequiereSesion><Comprobante /></RequiereSesion>} />
        <Route path="mis-votos" element={<RequiereSesion><MisVotos /></RequiereSesion>} />
        {/* Administración */}
        <Route path="admin" element={<RequiereAdmin><AdminLayout /></RequiereAdmin>}>
          <Route index element={<AdminPanel />} />
          <Route path="ediciones" element={<AdminEdiciones />} />
          <Route path="categorias" element={<AdminCategorias />} />
          <Route path="votaciones" element={<AdminVotaciones />} />
          <Route path="votaciones/:id/opciones" element={<AdminOpciones />} />
          <Route path="resultados" element={<AdminResultados />} />
        </Route>
        <Route path="*" element={<NoEncontrado />} />
      </Route>
    </Routes>
  );
}
