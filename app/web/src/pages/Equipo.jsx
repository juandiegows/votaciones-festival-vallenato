import PageHeader from '../components/PageHeader.jsx';
import { useSeo } from '../hooks/useSeo.js';

const INTEGRANTES = [
  { nombre: 'Sebastián Bautista Martínez', iniciales: 'SB', aporte: 'Modelo de datos, migraciones, reglas del voto y API.' },
  { nombre: 'María Virginia Labarca Briceño', iniciales: 'ML', aporte: 'Documentación del proyecto, guion del video e informes.' },
  { nombre: 'Juan Mejía Maestre', iniciales: 'JM', aporte: 'Pantallas de votación, pruebas y coordinación.' },
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
              <p className="text-secondary-flv mb-0">{integrante.aporte}</p>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
