import { formatearFechaHora } from '../../utils/helpers.js';
import TablaResponsiva from '../TablaResponsiva.jsx';

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
      <TablaResponsiva
        titulo="Verificación de integridad por votación"
        filas={votaciones}
        clave={(v) => v.id}
        nombreFila={(v) => v.titulo}
        claseFila={(v) => (v.ok ? '' : 'table-danger')}
        vacio="Esta edición no tiene votaciones."
        columnas={[
          {
            id: 'votacion', titulo: 'Votación', minimo: '11rem', prioridad: 0,
            celda: (v) => (
              <>
                <button type="button" className="btn btn-link p-0 text-start fw-semibold text-reset" onClick={() => onElegir?.(v.id)}>{v.titulo}</button>
                <div className="small text-secondary-flv">{v.categoria} · {v.votosPorUsuario} voto(s) por persona</div>
              </>
            ),
          },
          { id: 'votos', titulo: 'Votos', celda: (v) => v.totalVotos, claseTh: 'text-end', claseTd: 'text-end', prioridad: 2 },
          {
            id: 'suma', titulo: 'Suma por opción', claseTh: 'text-end', claseTd: 'text-end text-nowrap', prioridad: 3,
            celda: (v) => (
              <>
                {v.sumaPorOpcion}{' '}
                <i
                  className={`bi ${v.sumaPorOpcion === v.totalVotos ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger'}`}
                  role="img"
                  aria-label={v.sumaPorOpcion === v.totalVotos ? 'coincide' : 'no coincide'}
                ></i>
              </>
            ),
          },
          { id: 'votantes', titulo: 'Votantes', celda: (v) => v.votantesUnicos, claseTh: 'text-end', claseTd: 'text-end', prioridad: 3 },
          {
            id: 'controles', titulo: 'Controles', prioridad: 1,
            celda: (v) => (v.ok ? (
              <span className="small text-success text-nowrap"><i className="bi bi-check2-all me-1" aria-hidden="true"></i>Sin novedades</span>
            ) : (
              <ul className="small mb-0 ps-3 text-danger">{v.alertas.map((a) => <li key={a}>{a}</li>)}</ul>
            )),
          },
        ]}
      />
      <p className="small text-secondary-flv mt-2 mb-0">
        Se verifica por votación: que el total coincida con la suma por opción, que nadie supere el límite de votos (votos
        repetidos), que no haya votos en opciones de otra votación o desactivadas, ni fuera del horario, y que cada comprobante sea único.
      </p>
    </>
  );
}
