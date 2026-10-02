import { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import EstadoBadge from '../../components/EstadoBadge.jsx';
import ResultadosChart from '../../components/ResultadosChart.jsx';
import { formatearFechaHora, resultadosVisibles } from '../../utils/helpers.js';
import { useResultados } from '../../hooks/useResultados.js';

export default function AdminResultados() {
  const { votaciones, categorias, guardarEntidad, exportarResultadosCSV } = useApp();
  const conDatos = votaciones.filter((v) => v.publicada);
  const [seleccion, setSeleccion] = useState(conDatos[0]?.id || '');
  const [mensaje, setMensaje] = useState(null);
  const [procesando, setProcesando] = useState(false);

  const votacion = votaciones.find((v) => v.id === Number(seleccion));
  const { cargando, total, filas, error } = useResultados(votacion?.id, { admin: true });
  const ganadoras = filas.filter((f) => f.ganador);
  const categoria = categorias.find((c) => c.id === votacion?.categoriaId);

  const exportar = async () => {
    setProcesando(true);
    const r = await exportarResultadosCSV(votacion.id);
    setProcesando(false);
    setMensaje(r.ok ? { tipo: 'success', texto: `Archivo ${r.nombre} descargado.` } : { tipo: 'danger', texto: r.error });
  };

  const alternarPublicacion = async () => {
    const nuevo = !votacion.resultadosPublicados;
    setProcesando(true);
    const r = await guardarEntidad('votaciones', { id: votacion.id, resultadosPublicados: nuevo }, `${nuevo ? 'Publicó' : 'Retiró'} los resultados de "${votacion.titulo}"`);
    setProcesando(false);
    if (!r.ok) return setMensaje({ tipo: 'danger', texto: r.error });
    setMensaje({ tipo: 'success', texto: nuevo ? 'Resultados publicados para el público (RF-15).' : 'Publicación manual de resultados retirada.' });
  };

  return (
    <>
      <PageHeader titulo="Consulta de resultados" subtitulo="Conteo por opción, exportación y publicación (RF-14, RF-15)." />
      <div className="card-flv p-3 mb-3">
        <label htmlFor="sel-votacion" className="form-label">Selecciona una votación</label>
        <select id="sel-votacion" className="form-select" value={seleccion} onChange={(e) => { setSeleccion(e.target.value); setMensaje(null); }}>
          {categorias.map((c) => {
            const vs = conDatos.filter((v) => v.categoriaId === c.id);
            if (!vs.length) return null;
            return (
              <optgroup key={c.id} label={c.nombre}>
                {vs.map((v) => <option key={v.id} value={v.id}>{v.titulo} ({v.estado})</option>)}
              </optgroup>
            );
          })}
        </select>
      </div>

      {votacion && (
        <div className="row g-3">
          <div className="col-xl-8">
            <section className="card-flv p-3 p-md-4 h-100" aria-labelledby="titulo-grafico">
              <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
                <div>
                  <h2 id="titulo-grafico" className="h5 mb-1">{votacion.titulo}</h2>
                  <p className="small text-secondary-flv mb-0">{categoria?.nombre} · Cierre: {formatearFechaHora(votacion.fechaCierre)}</p>
                </div>
                <EstadoBadge estado={votacion.estado} />
              </div>
              {error ? (
                <div className="alert alert-danger mb-0" role="alert">{error}</div>
              ) : cargando && !filas.length ? (
                <p className="mb-0" role="status"><span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Cargando resultados…</p>
              ) : (
                <ResultadosChart total={total} filas={filas} cerrada={votacion.estado === 'cerrada'} />
              )}
            </section>
          </div>
          <div className="col-xl-4">
            <section className="card-flv p-3 p-md-4 mb-3" aria-labelledby="titulo-resumen">
              <h2 id="titulo-resumen" className="h6">Resumen</h2>
              <p className="kpi-valor mb-0">{total.toLocaleString('es-CO')}</p>
              <p className="small text-secondary-flv">votos totales</p>
              {ganadoras.length > 0 && (
                <div className="p-3 rounded-3" style={{ background: 'var(--flv-crema)' }}>
                  <p className="small mb-1"><i className="bi bi-trophy-fill me-1" style={{ color: 'var(--flv-dorado-texto)' }} aria-hidden="true"></i>{votacion.estado === 'cerrada' ? 'Ganadora' : 'Va ganando'}{ganadoras.length > 1 ? ' (empate)' : ''}</p>
                  {ganadoras.map((g) => <p key={g.id} className="fw-bold mb-0">{g.nombre} · {g.porcentaje.toFixed(1)} %</p>)}
                </div>
              )}
            </section>
            <section className="card-flv p-3 p-md-4" aria-labelledby="titulo-acciones">
              <h2 id="titulo-acciones" className="h6">Acciones</h2>
              <button className="btn btn-primary w-100 mb-3" onClick={exportar} disabled={procesando}>
                <i className="bi bi-filetype-csv me-1" aria-hidden="true"></i>Exportar CSV
              </button>
              <div className="form-check form-switch">
                <input className="form-check-input" type="checkbox" role="switch" id="publicar-res" checked={!!votacion.resultadosPublicados} disabled={procesando} onChange={alternarPublicacion} aria-describedby="publicar-ayuda" />
                <label className="form-check-label fw-semibold" htmlFor="publicar-res">Publicar resultados</label>
              </div>
              <p id="publicar-ayuda" className="small text-secondary-flv mt-2 mb-1">
                Configuración: «{votacion.mostrarResultados}». Visibles al público ahora:{' '}
                <strong>{resultadosVisibles(votacion) ? 'Sí' : 'No'}</strong> (RN-07).
              </p>
              {mensaje && <div className={`alert alert-${mensaje.tipo} small py-2 mt-2 mb-0`} role="status">{mensaje.texto}</div>}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
