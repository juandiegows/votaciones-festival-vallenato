import PageHeader from '../components/PageHeader.jsx';
import { useSeo } from '../hooks/useSeo.js';

const INTEGRANTES = [
  { nombre: 'Sebastián Bautista Martínez', iniciales: 'SB', github: 'sbautista15' },
  { nombre: 'María Virginia Labarca Briceño', iniciales: 'ML', github: 'mlabarca-jpg' },
  { nombre: 'Juan Mejía Maestre', iniciales: 'JM', github: 'juandiegows' },
];

export default function Equipo() {
  useSeo({ titulo: 'Equipo' });

  return (
    <div className="container py-4 py-md-5">
      <PageHeader
        titulo="Equipo"
        subtitulo="Integrantes del proyecto Votaciones FLV · Desarrollo Web · Fundación Universitaria del Área Andina."
        migas={[{ label: 'Inicio', to: '/' }, { label: 'Equipo' }]}
      />
      <ul className="list-unstyled row g-3 mb-0">
        {INTEGRANTES.map((integrante) => (
          <li className="col-md-4" key={integrante.nombre}>
            <article className="card-flv p-4 h-100 text-center">
              <span className="icono-circulo fw-bold mb-3" aria-hidden="true">{integrante.iniciales}</span>
              <h2 className="h5 mb-2">{integrante.nombre}</h2>
              <a href={`https://github.com/${integrante.github}`} target="_blank" rel="noopener noreferrer" aria-label={`Perfil de GitHub de ${integrante.nombre} (se abre en una pestaña nueva)`}>
                <i className="bi bi-github me-1" aria-hidden="true"></i>{integrante.github}
              </a>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
