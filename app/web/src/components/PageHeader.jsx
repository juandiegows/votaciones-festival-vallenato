import { Link } from 'react-router-dom';

export default function PageHeader({ titulo, subtitulo, migas = [], children }) {
  return (
    <header className="mb-4">
      {migas.length > 0 && (
        <nav aria-label="Ruta de navegación">
          <ol className="breadcrumb mb-2">
            {migas.map((m, i) => (
              <li key={i} className={`breadcrumb-item ${m.to ? '' : 'active'}`} aria-current={m.to ? undefined : 'page'}>
                {m.to ? <Link to={m.to}>{m.label}</Link> : m.label}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
        <div>
          <h1 className="h2 mb-1">{titulo}</h1>
          {subtitulo && <p className="text-secondary-flv mb-0">{subtitulo}</p>}
        </div>
        {children}
      </div>
    </header>
  );
}
