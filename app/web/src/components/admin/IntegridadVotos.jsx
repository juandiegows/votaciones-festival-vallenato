import { formatearFechaHora } from '../../utils/helpers.js';

/** Verificación de que todo cuadre: total = suma por opción, sin votos repetidos ni fuera de regla. */
export default function IntegridadVotos({ integridad, onElegir }) {
  const { resumen, votaciones, ok, generado } = integridad;
  return (
    <>
      <div className={`alert ${ok ? 'alert-success' : 'alert-danger'} d-flex align-items-center gap-2`} role="status">
        <i className={`bi ${ok ? 'bi-patch-check-fill' : 'bi-exclamation-octagon-fill'} fs-4`} aria-hidden="true"></i>
        <div>
          <strong>{ok ? 'Todo cuadra.' : `${resumen.conAlertas} votación(es) con alertas.`}</strong>{' '}
          {resumen.totalVotos.toLocaleString('es-CO')} votos de {resumen.votantesUnicos.toLocaleString('es-CO')} votantes en {resumen.votaciones} votaciones.
          <span className="d-block small">Verificado: {formatearFechaHora(generado)}</span>
        </div>
      </div>
      <div className="table-responsive card-flv">
        <table className="table table-flv align-middle mb-0">
          <caption className="visually-hidden">Verificación de integridad por votación</caption>
          <thead>
            <tr>
              <th scope="col">Votación</th>
              <th scope="col" className="text-end">Votos</th>
              <th scope="col" className="text-end">Suma por opción</th>
              <th scope="col" className="text-end">Votantes</th>
              <th scope="col">Controles</th>
            </tr>
          </thead>
          <tbody>
            {votaciones.map((v) => (
              <tr key={v.id} className={v.ok ? '' : 'table-danger'}>
                <td>
                  <button type="button" className="btn btn-link p-0 text-start fw-semibold text-reset" onClick={() => onElegir?.(v.id)}>{v.titulo}</button>
                  <div className="small text-secondary-flv">{v.categoria} · {v.votosPorUsuario} voto(s) por persona</div>
                </td>
                <td className="text-end">{v.totalVotos}</td>
                <td className="text-end text-nowrap">
                  {v.sumaPorOpcion}{' '}
                  <i
                    className={`bi ${v.sumaPorOpcion === v.totalVotos ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger'}`}
                    role="img"
                    aria-label={v.sumaPorOpcion === v.totalVotos ? 'coincide' : 'no coincide'}
                  ></i>
                </td>
                <td className="text-end">{v.votantesUnicos}</td>
                <td>
                  {v.ok ? (
                    <span className="small text-success"><i className="bi bi-check2-all me-1" aria-hidden="true"></i>Sin novedades</span>
                  ) : (
                    <ul className="small mb-0 ps-3 text-danger">{v.alertas.map((a) => <li key={a}>{a}</li>)}</ul>
                  )}
                </td>
              </tr>
            ))}
            {votaciones.length === 0 && <tr><td colSpan="5" className="text-center py-4">Esta edición no tiene votaciones.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="small text-secondary-flv mt-2 mb-0">
        Se verifica por votación: que el total coincida con la suma por opción, que nadie supere el límite de votos (votos
        repetidos), que no haya votos en opciones de otra votación o desactivadas, ni fuera del horario, y que cada comprobante sea único.
      </p>
    </>
  );
}
