import { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import PageHeader from '../components/PageHeader.jsx';
import VotacionCard from '../components/VotacionCard.jsx';
import NoEncontrado from './NoEncontrado.jsx';
import { edicionPublica, votacionesPublicas } from '../utils/visibilidad.js';
import { useRutaPublica, useRutas } from '../hooks/useRutas.js';
import { migasJsonLd, useSeo } from '../hooks/useSeo.js';

const FILTROS = [
  ['todas', 'Todas'],
  ['abierta', 'Abiertas'],
  ['programada', 'Programadas'],
  ['cerrada', 'Cerradas'],
];

export default function CategoriaVotaciones() {
  const datos = useApp();
  const { opciones, votosDeUsuario } = datos;
  const [filtro, setFiltro] = useState('todas');
  const { edicion, categoria } = useRutaPublica();
  const rutas = useRutas();
  const visible = categoria?.activa && edicionPublica(edicion);
  useSeo(visible ? {
    titulo: `${categoria.nombre} · Edición ${edicion.anio}`,
    descripcion: categoria.descripcion || `Votaciones de la categoría ${categoria.nombre} del ${edicion.nombre}.`,
    jsonLd: migasJsonLd([['Inicio', '/'], [`Edición ${edicion.anio}`, rutas.edicion(edicion)], [categoria.nombre, rutas.categoria(categoria)]]),
  } : null);
  if (!categoria || !categoria.activa || !edicionPublica(edicion)) return <NoEncontrado mensaje="La categoría no existe o no está activa." />;

  const todas = votacionesPublicas(datos, edicion).filter((v) => v.categoriaId === categoria.id);
  const lista = filtro === 'todas' ? todas : todas.filter((v) => v.estado === filtro);

  return (
    <div className="container py-4 py-md-5">
      <PageHeader
        titulo={categoria.nombre}
        subtitulo={`Votaciones disponibles · ${categoria.descripcion}`}
        migas={[{ label: 'Inicio', to: '/' }, { label: `Edición ${edicion.anio}`, to: rutas.edicion(edicion) }, { label: categoria.nombre }]}
      />
      <fieldset className="mb-4">
        <legend className="small fw-semibold mb-2">Filtrar por estado</legend>
        <div className="d-flex flex-wrap gap-2" role="group">
          {FILTROS.map(([valor, etiqueta]) => {
            const n = valor === 'todas' ? todas.length : todas.filter((v) => v.estado === valor).length;
            return (
              <button
                key={valor}
                type="button"
                className={`btn btn-sm ${filtro === valor ? 'btn-primary' : 'btn-outline-primary'}`}
                aria-pressed={filtro === valor}
                onClick={() => setFiltro(valor)}
              >
                {etiqueta} <span className="badge text-bg-light ms-1">{n}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <p className="visually-hidden" aria-live="polite">{lista.length} votaciones mostradas</p>
      {lista.length === 0 ? (
        <div className="card-flv p-4 text-center">
          <i className="bi bi-inbox fs-1 text-secondary" aria-hidden="true"></i>
          <p className="mb-0">No hay votaciones con este estado en la categoría.</p>
        </div>
      ) : (
        <div className="row g-3">
          {lista.map((v) => (
            <div className="col-md-6 col-lg-4" key={v.id}>
              <VotacionCard votacion={v} numOpciones={opciones.filter((o) => o.votacionId === v.id).length} yaVoto={votosDeUsuario(v.id).length > 0} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
