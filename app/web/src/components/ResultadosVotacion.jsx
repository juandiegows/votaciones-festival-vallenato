import { useResultados } from '../hooks/useResultados.js';
import ResultadosChart from './ResultadosChart.jsx';

// Resultados públicos de una votación: muestra el gráfico o el motivo por el que aún no son públicos.
export default function ResultadosVotacion({ votacion, nota }) {
  // «En tiempo real» y abierta: se vuelve a consultar cada 15 s
  const enVivo = votacion.mostrarResultados === 'en tiempo real' && votacion.estado === 'abierta';
  const { cargando, total, filas, error } = useResultados(votacion.id, { intervalo: enVivo ? 15000 : 0 });

  if (cargando && !filas.length && !error) {
    return (
      <p className="mb-0 text-secondary-flv" role="status">
        <span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Cargando resultados…
      </p>
    );
  }
  if (error) {
    return (
      <div className="text-center py-3">
        <i className="bi bi-hourglass-split fs-1 text-dorado-texto" aria-hidden="true"></i>
        <p className="mt-2 mb-0">{error}</p>
      </div>
    );
  }
  return (
    <>
      {nota && <p className="small text-secondary-flv">{nota}</p>}
      <ResultadosChart total={total} filas={filas} cerrada={votacion.estado === 'cerrada'} />
    </>
  );
}
