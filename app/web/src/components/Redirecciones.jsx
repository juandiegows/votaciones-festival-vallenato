import { Navigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext.jsx';
import { useRutas } from '../hooks/useRutas.js';
import NoEncontrado from '../pages/NoEncontrado.jsx';
import SinEdicion from './SinEdicion.jsx';

// /categorias → /{año de la edición activa}
export function IrAEdicionActiva() {
  const { edicionActiva } = useApp();
  if (!edicionActiva) return <SinEdicion />;
  return <Navigate to={`/${edicionActiva.anio}`} replace />;
}

// Compatibilidad con las rutas anteriores basadas en ID (/categorias/:id, /votaciones/:id[/comprobante])
export function RedireccionCategoria() {
  const { id } = useParams();
  const { categorias } = useApp();
  const rutas = useRutas();
  const categoria = categorias.find((c) => c.id === Number(id));
  return categoria ? <Navigate to={rutas.categoria(categoria)} replace /> : <NoEncontrado />;
}

export function RedireccionVotacion({ comprobante = false }) {
  const { id } = useParams();
  const { votaciones } = useApp();
  const rutas = useRutas();
  const votacion = votaciones.find((v) => v.id === Number(id));
  if (!votacion) return <NoEncontrado />;
  return <Navigate to={comprobante ? rutas.comprobante(votacion) : rutas.votacion(votacion)} replace />;
}
