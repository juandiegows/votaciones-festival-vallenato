import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { RequiereAdmin, RequierePermiso, RequiereSesion } from './components/Guards.jsx';
import { IrAEdicionActiva, RedireccionCategoria, RedireccionRutaAnterior, RedireccionVotacion } from './components/Redirecciones.jsx';
import Inicio from './pages/Inicio.jsx';
import Equipo from './pages/Equipo.jsx';
import Registro from './pages/Registro.jsx';
import Login from './pages/Login.jsx';
import ConfirmarCorreo from './pages/ConfirmarCorreo.jsx';
import Categorias from './pages/Categorias.jsx';
import CategoriaVotaciones from './pages/CategoriaVotaciones.jsx';
import VotacionDetalle from './pages/VotacionDetalle.jsx';
import Comprobante from './pages/Comprobante.jsx';
import MisVotos from './pages/MisVotos.jsx';
import NoEncontrado from './pages/NoEncontrado.jsx';
import { RutaError } from './pages/errores/PaginaError.jsx';
import Marca from './pages/Marca.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminPanel from './pages/admin/AdminPanel.jsx';
import AdminCategorias from './pages/admin/AdminCategorias.jsx';
import AdminVotaciones from './pages/admin/AdminVotaciones.jsx';
import AdminOpciones from './pages/admin/AdminOpciones.jsx';
import AdminResultados from './pages/admin/AdminResultados.jsx';
import AdminEdiciones from './pages/admin/AdminEdiciones.jsx';
import AdminAuditoria from './pages/admin/AdminAuditoria.jsx';
import AdminUsuarios from './pages/admin/AdminUsuarios.jsx';
import AdminBanner from './pages/admin/AdminBanner.jsx';
import AdminSitio from './pages/admin/AdminSitio.jsx';
import AdminConfiguracion from './pages/admin/AdminConfiguracion.jsx';
import AdminRevista from './pages/admin/AdminRevista.jsx';
import AdminRoles from './pages/admin/AdminRoles.jsx';
import AdminRegistros from './pages/admin/AdminRegistros.jsx';

// Cada sección del panel exige su permiso `.ver` (catálogo en src/data/permisos.js); sin él, página 403
const con = (permiso, pantalla) => <RequierePermiso permiso={permiso}>{pantalla}</RequierePermiso>;

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
        <Route path="confirmar-correo" element={<ConfirmarCorreo />} />
        <Route path="marca" element={<Navigate to="/panel/marca" replace />} />
        <Route path="error/:codigo" element={<RutaError />} />
        <Route path="equipo" element={<Equipo />} />
        <Route path="categorias" element={<IrAEdicionActiva />} />
        <Route path="categorias/:id" element={<RedireccionCategoria />} />
        <Route path="votaciones/:id" element={<RedireccionVotacion />} />
        <Route path="votaciones/:id/comprobante" element={<RedireccionVotacion comprobante />} />
        {/* Votante autenticado */}
        <Route path="mis-votos" element={<RequiereSesion><MisVotos /></RequiereSesion>} />
        {/* Administración */}
        <Route path="panel" element={<RequiereAdmin><AdminLayout /></RequiereAdmin>}>
          <Route index element={<AdminPanel />} />
          <Route path="ediciones" element={con('ediciones.ver', <AdminEdiciones />)} />
          <Route path="categorias" element={con('categorias.ver', <AdminCategorias />)} />
          <Route path="votaciones" element={con('votaciones.ver', <AdminVotaciones />)} />
          <Route path="votaciones/:id/opciones" element={con('opciones.ver', <AdminOpciones />)} />
          <Route path="resultados" element={con('resultados.ver', <AdminResultados />)} />
          <Route path="auditoria" element={con('auditoria.ver', <AdminAuditoria />)} />
          <Route path="usuarios" element={con('usuarios.ver', <AdminUsuarios />)} />
          <Route path="roles" element={con('roles.ver', <AdminRoles />)} />
          <Route path="banner" element={con('sitio.ver', <AdminBanner />)} />
          <Route path="revista" element={con('sitio.ver', <AdminRevista />)} />
          <Route path="sitio" element={con('sitio.ver', <AdminSitio />)} />
          <Route path="configuracion" element={con('configuracion.ver', <AdminConfiguracion />)} />
          <Route path="configuracion/:seccion" element={con('configuracion.ver', <AdminConfiguracion />)} />
          {/* /panel/{sección}/configuracion u otra ruta desconocida del panel → la pantalla correcta */}
          <Route path=":seccion/configuracion" element={<Navigate to="/panel/configuracion" replace />} />
          <Route path="marca" element={con('sitio.ver', <Marca />)} />
          <Route path="registros" element={con('registros.ver', <AdminRegistros />)} />
        </Route>
        {/* URL amigables por edición: /{año}/categorias/{categoría}/{votación} */}
        <Route path=":anio" element={<Categorias />} />
        <Route path=":anio/categorias" element={<Navigate to=".." relative="path" replace />} />
        <Route path=":anio/categorias/:categoriaSlug" element={<CategoriaVotaciones />} />
        <Route path=":anio/categorias/:categoriaSlug/:votacionSlug" element={<VotacionDetalle />} />
        <Route path=":anio/categorias/:categoriaSlug/:votacionSlug/comprobante" element={<RequiereSesion><Comprobante /></RequiereSesion>} />
        {/* Compatibilidad con las URL anteriores sin «categorias»: /{año}/{categoría}[/{votación}[/comprobante]] */}
        <Route path=":anio/:categoriaSlug/*" element={<RedireccionRutaAnterior />} />
        <Route path="*" element={<NoEncontrado />} />
      </Route>
    </Routes>
  );
}
