import { calcularResultados } from '../utils/helpers.js';

// Gráfico de barras horizontales en CSS (sin librerías)
export default function ResultadosChart({ opciones, votos, cerrada = false }) {
  const { total, filas } = calcularResultados(opciones, votos);
  return (
    <div>
      <p className="mb-3">
        Total de votos: <strong>{total.toLocaleString('es-CO')}</strong>
      </p>
      <ol className="list-unstyled mb-0" aria-label="Resultados por opción">
        {filas.map((f) => (
          <li key={f.id} className="mb-3">
            <div className="d-flex justify-content-between gap-2 small mb-1">
              <span className="fw-semibold">
                {f.ganador && (
                  <span className="badge badge-dorado me-1">
                    <i className="bi bi-trophy-fill me-1" aria-hidden="true"></i>{cerrada ? 'Ganadora' : 'Primer lugar'}
                  </span>
                )}
                {f.nombre}
              </span>
              <span className="text-nowrap">
                {f.cantidad} · <strong>{f.porcentaje.toFixed(1)} %</strong>
              </span>
            </div>
            <div
              className="barra-fondo"
              role="progressbar"
              aria-valuenow={Math.round(f.porcentaje)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${f.nombre}: ${f.porcentaje.toFixed(1)} %`}
            >
              <div className={`barra ${f.ganador ? 'ganadora' : ''}`} style={{ width: `${f.porcentaje}%` }}></div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
