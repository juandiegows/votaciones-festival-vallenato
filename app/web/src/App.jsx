import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { RequiereAdmin, RequiereSesion } from './components/Guards.jsx';
import { IrAEdicionActiva, RedireccionCategoria, RedireccionVotacion } from './components/Redirecciones.jsx';
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
import AdminAuditoria from './pages/admin/AdminAuditoria.jsx';
import AdminBanner from './pages/admin/AdminBanner.jsx';
import AdminSitio from './pages/admin/AdminSitio.jsx';
import AdminRevista from './pages/admin/AdminRevista.jsx';

// Las rutas fijas (registro, login, admin…) tienen prioridad sobre /:anio. La web nunca usa
// /api, /django-admin ni /static: en producción esas rutas las atiende Django.
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Público */}
        <Route index element={<Inicio />} />
        <Route path="registro" element={<Registro />} />
        <Route path="login" element={<Login />} />
        <Route path="marca" element={<Navigate to="/panel/marca" replace />} />
        <Route path="categorias" element={<IrAEdicionActiva />} />
        <Route path="categorias/:id" element={<RedireccionCategoria />} />
        <Route path="votaciones/:id" element={<RedireccionVotacion />} />
        <Route path="votaciones/:id/comprobante" element={<RedireccionVotacion comprobante />} />
        {/* Votante autenticado */}
        <Route path="mis-votos" element={<RequiereSesion><MisVotos /></RequiereSesion>} />
        {/* Administración */}
        <Route path="panel" element={<RequiereAdmin><AdminLayout /></RequiereAdmin>}>
          <Route index element={<AdminPanel />} />
          <Route path="ediciones" element={<AdminEdiciones />} />
          <Route path="categorias" element={<AdminCategorias />} />
          <Route path="votaciones" element={<AdminVotaciones />} />
          <Route path="votaciones/:id/opciones" element={<AdminOpciones />} />
          <Route path="resultados" element={<AdminResultados />} />
          <Route path="auditoria" element={<AdminAuditoria />} />
          <Route path="banner" element={<AdminBanner />} />
          <Route path="revista" element={<AdminRevista />} />
          <Route path="sitio" element={<AdminSitio />} />
          <Route path="marca" element={<Marca />} />
        </Route>
        {/* URL amigables por edición: /{año}/{categoría}/{votación} */}
        <Route path=":anio" element={<Categorias />} />
        <Route path=":anio/:categoriaSlug" element={<CategoriaVotaciones />} />
        <Route path=":anio/:categoriaSlug/:votacionSlug" element={<VotacionDetalle />} />
        <Route path=":anio/:categoriaSlug/:votacionSlug/comprobante" element={<RequiereSesion><Comprobante /></RequiereSesion>} />
        <Route path="*" element={<NoEncontrado />} />
      </Route>
    </Routes>
  );
}
