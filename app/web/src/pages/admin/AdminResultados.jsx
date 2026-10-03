import { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { useEdicionAdmin } from '../../context/EdicionAdmin.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import EstadoBadge from '../../components/EstadoBadge.jsx';
import ResultadosChart from '../../components/ResultadosChart.jsx';
import IndicadorEnVivo from '../../components/admin/IndicadorEnVivo.jsx';
import ResumenResultados from '../../components/admin/ResumenResultados.jsx';
import ParticipacionVotacion from '../../components/admin/ParticipacionVotacion.jsx';
import SelectorVista, { useVistaGuardada } from '../../components/SelectorVista.jsx';
import { formatearFechaHora, resultadosVisibles, visibilidadResultados } from '../../utils/helpers.js';
import { useResultados } from '../../hooks/useResultados.js';
import { INTERVALO_EN_VIVO, useConsultaEnVivo } from '../../hooks/useConsultaEnVivo.js';

export default function AdminResultados() {
  const { guardarEntidad, exportarResultadosCSV, obtenerResumen } = useApp();
  const { edicion, categorias, votaciones } = useEdicionAdmin();
  const [seleccion, setSeleccion] = useState('');
  const [enVivo, setEnVivo] = useState(true);
  const [mensaje, setMensaje] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [vista, setVista] = useVistaGuardada('resultados', 'tarjetas');
  const intervalo = enVivo ? INTERVALO_EN_VIVO : 0;

  const votacion = votaciones.find((v) => v.id === Number(seleccion));
  const resultados = useResultados(votacion?.id, { admin: true, intervalo });
  const resumen = useConsultaEnVivo(() => obtenerResumen(edicion.id), [edicion?.id], { intervalo, activa: !!edicion && !votacion });
  const { cargando, total, filas, error } = resultados;
  const ganadoras = filas.filter((f) => f.ganador);
  const categoria = categorias.find((c) => c.id === votacion?.categoriaId);
  const consulta = votacion ? resultados : resumen;

  const elegir = (id) => {
    setSeleccion(id ? String(id) : '');
    setMensaje(null);
  };

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
    setMensaje({ tipo: 'success', texto: nuevo ? 'Resultados publicados para el público.' : 'Publicación manual de resultados retirada.' });
  };

  if (!edicion) {
    return (
      <>
        <PageHeader titulo="Consulta de resultados" />
        <div className="alert alert-info">Crea una edición en «Ediciones» para ver resultados.</div>
      </>
    );
  }

  return (
    <>
      <PageHeader titulo="Consulta de resultados" subtitulo={`${edicion.nombre} · Conteo en tiempo real, exportación y publicación.`} />
      <div className="card-flv p-3 mb-3">
        <div className="row g-2 align-items-end">
          <div className="col-md">
            <label htmlFor="sel-votacion" className="form-label">Votación</label>
            <select id="sel-votacion" className="form-select" value={seleccion} onChange={(e) => elegir(e.target.value)}>
              <option value="">Todas las votaciones (resumen por categoría)</option>
              {categorias.map((c) => {
                const vs = votaciones.filter((v) => v.categoriaId === c.id);
                if (!vs.length) return null;
                return (
                  <optgroup key={c.id} label={c.nombre}>
                    {vs.map((v) => <option key={v.id} value={v.id}>{v.titulo} ({v.publicada ? v.estado : 'borrador'})</option>)}
                  </optgroup>
                );
              })}
            </select>
          </div>
          <div className="col-md-auto">
            <IndicadorEnVivo id="res-en-vivo" activo={enVivo} onCambio={setEnVivo} actualizado={consulta.actualizado} cargando={consulta.cargando} />
          </div>
        </div>
      </div>

      {!votacion &&
        (resumen.error ? (
          <div className="alert alert-danger" role="alert">{resumen.error}</div>
        ) : !resumen.datos ? (
          <p role="status"><span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Cargando resumen…</p>
        ) : (
          <>
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
              <p className="small mb-0">
                <strong>{resumen.datos.totalVotos.toLocaleString('es-CO')}</strong> votos en la edición. Selecciona una votación para ver el gráfico, exportar o consultar quién votó.
              </p>
              <SelectorVista valor={vista} onCambio={setVista} />
            </div>
            <ResumenResultados resumen={resumen.datos} onElegir={elegir} vista={vista} />
          </>
        ))}

      {votacion && (
        <div className="row g-3">
          <div className="col-xl-8">
            <section className="card-flv p-3 p-md-4 mb-3" aria-labelledby="titulo-grafico">
              <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
                <div>
                  <h2 id="titulo-grafico" className="h5 mb-1">{votacion.titulo}</h2>
                  <p className="small text-secondary-flv mb-0">{categoria?.nombre} · Cierre: {formatearFechaHora(votacion.fechaCierre)}</p>
                </div>
                {votacion.publicada ? <EstadoBadge estado={votacion.estado} /> : <span className="badge text-bg-secondary">Borrador</span>}
              </div>
              {error ? (
                <div className="alert alert-danger mb-0" role="alert">{error}</div>
              ) : cargando ? (
                <p className="mb-0" role="status"><span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Cargando resultados…</p>
              ) : (
                <ResultadosChart total={total} filas={filas} cerrada={votacion.estado === 'cerrada'} />
              )}
            </section>
            <section className="card-flv p-3 p-md-4" aria-labelledby="titulo-participacion">
              <h2 id="titulo-participacion" className="h6"><i className="bi bi-people me-1" aria-hidden="true"></i>Quién votó</h2>
              <ParticipacionVotacion votacionId={votacion.id} intervalo={intervalo} />
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
              <button type="button" className="btn btn-link px-0 mt-2" onClick={() => elegir('')}>
                <i className="bi bi-arrow-left me-1" aria-hidden="true"></i>Ver resumen de todas
              </button>
            </section>
            <section className="card-flv p-3 p-md-4" aria-labelledby="titulo-acciones">
              <h2 id="titulo-acciones" className="h6">Acciones</h2>
              <button className="btn btn-primary w-100 mb-3" onClick={exportar} disabled={procesando}>
                <i className="bi bi-filetype-csv me-1" aria-hidden="true"></i>Exportar CSV
              </button>
              <div className="form-check form-switch">
                <input className="form-check-input" type="checkbox" role="switch" id="publicar-res" checked={!!votacion.resultadosPublicados} disabled={procesando || !votacion.publicada} onChange={alternarPublicacion} aria-describedby="publicar-ayuda" />
                <label className="form-check-label fw-semibold" htmlFor="publicar-res">Publicar resultados</label>
              </div>
              <p id="publicar-ayuda" className="small text-secondary-flv mt-2 mb-1">
                Configuración: «{visibilidadResultados(votacion)}» ({votacion.personalizarResultados ? 'personalizada en la votación' : 'de la edición'}). Visibles al público ahora:{' '}
                <strong>{votacion.publicada && resultadosVisibles(votacion) ? 'Sí' : 'No'}</strong>.
              </p>
              {mensaje && <div className={`alert alert-${mensaje.tipo} small py-2 mt-2 mb-0`} role="status">{mensaje.texto}</div>}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
