import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import { useEdicionAdmin } from '../../context/EdicionAdmin.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import EstadoBadge from '../../components/EstadoBadge.jsx';
import IndicadorEnVivo from '../../components/admin/IndicadorEnVivo.jsx';
import { INTERVALO_EN_VIVO } from '../../hooks/useConsultaEnVivo.js';
import { formatearFechaHora } from '../../utils/helpers.js';
import { pendientesPanel, rutaTrabajo } from '../../utils/guiaPanel.js';

export default function AdminPanel() {
  const { usuarios, auditoria, edicionActiva, usuario, modo, recargar, puede } = useApp();
  const { edicion, esActiva, votaciones, votos, categorias, opciones } = useEdicionAdmin();
  const [enVivo, setEnVivo] = useState(true);
  const [actualizado, setActualizado] = useState(() => new Date());
  const [cargando, setCargando] = useState(false);

  // Tiempo real: en modo API se vuelven a pedir los datos; en el modo demostración llegan solos entre pestañas
  useEffect(() => {
    if (!enVivo) return undefined;
    const t = setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      setCargando(true);
      if (modo === 'api') await recargar();
      setCargando(false);
      setActualizado(new Date());
    }, INTERVALO_EN_VIVO * 2);
    return () => clearInterval(t);
  }, [enVivo, modo, recargar]);

  const abiertas = votaciones.filter((v) => v.publicada && v.estado === 'abierta');
  // Cada indicador depende de un permiso: sin él, el dato no llega de la API y el indicador no se muestra
  const kpis = [
    { label: 'Votaciones abiertas', valor: abiertas.length, icono: 'unlock', clase: '', to: '/panel/votaciones', permiso: 'votaciones.ver' },
    { label: 'Votos de la edición', valor: votos.length, icono: 'check2-all', clase: 'oro', to: '/panel/resultados', permiso: 'resultados.ver' },
    { label: 'Votantes registrados', valor: usuarios.filter((u) => u.rol === 'votante').length, icono: 'people', clase: 'terracota', to: '/panel/usuarios', permiso: 'usuarios.ver' },
    { label: 'Categorías activas', valor: categorias.filter((c) => c.activa).length, icono: 'grid', clase: 'oscuro', to: '/panel/categorias', permiso: 'categorias.ver' },
  ].filter((k) => puede(k.permiso));
  const verGuia = puede('votaciones.ver') && puede('categorias.ver');
  const verVotos = puede('resultados.ver');
  const verAuditoria = puede('auditoria.ver');
  const pasos = rutaTrabajo({ edicion, categorias, votaciones, puede });
  const pendientes = pendientesPanel({ edicion, hayActiva: !!edicionActiva, categorias, votaciones, opciones, puede });

  let saludo = 'No hay ediciones todavía.';
  if (edicion) saludo = esActiva ? `${edicion.nombre}.` : `Consultando ${edicion.nombre}${edicionActiva ? `; la activa es ${edicionActiva.anio}` : ''}.`;

  return (
    <>
      <PageHeader titulo="Panel de administración" subtitulo={`Hola, ${usuario.nombres}. ${saludo}`}>
        <IndicadorEnVivo id="panel-en-vivo" activo={enVivo} onCambio={setEnVivo} actualizado={actualizado} cargando={cargando} />
      </PageHeader>
      {kpis.length > 0 && <section aria-label="Indicadores" className="row g-3 mb-4">
        {kpis.map((k) => (
          <div className={`col-6 ${kpis.length === 4 ? 'col-xl-3' : kpis.length === 3 ? 'col-xl-4' : ''}`} key={k.label}>
            <div className={`card-flv kpi ${k.clase} p-3 h-100`}>
              <div className="d-flex justify-content-between align-items-start">
                <p className="small fw-semibold text-secondary-flv mb-2">{k.label}</p>
                <i className={`bi bi-${k.icono} fs-4 text-rojo`} aria-hidden="true"></i>
              </div>
              <p className="kpi-valor mb-0">{k.valor.toLocaleString('es-CO')}</p>
              {k.to && <Link to={k.to} className="small d-inline-block mt-2" aria-label={`Ver ${k.label.toLowerCase()}`}>Ver</Link>}
            </div>
          </div>
        ))}
      </section>}

      {!verGuia && (
        <section className="card-flv p-3 p-md-4 mb-4" aria-labelledby="titulo-rol">
          <h2 id="titulo-rol" className="h5 mb-1">Tu acceso al panel</h2>
          <p className="small mb-0">
            Tienes el rol <strong>{usuario.rolNombre || usuario.rol}</strong>. El menú muestra solo las secciones que tu rol puede ver; si necesitas otra,
            pídele a un administrador que agregue el permiso a tu rol.
          </p>
        </section>
      )}

      {verGuia && <section className="card-flv p-3 p-md-4 mb-4" aria-labelledby="titulo-ruta">
        <h2 id="titulo-ruta" className="h5 mb-1">Cómo se prepara una edición</h2>
        <p className="small text-secondary-flv">Cada paso depende del anterior. Una votación se puede publicar cuando tiene al menos 2 opciones.</p>
        <ol className="ruta-trabajo">
          {pasos.map((paso, i) => (
            <li key={paso.titulo}>
              {(() => {
                const contenido = (
                  <>
                    <span className="ruta-paso-marca" aria-hidden="true">{paso.lista ? <i className="bi bi-check-lg"></i> : i + 1}</span>
                    <span>
                      <span className="d-block fw-semibold">{paso.titulo}</span>
                      <span className="d-block small text-secondary-flv">{paso.detalle}<span className="visually-hidden">{paso.lista ? ' (listo)' : ' (pendiente)'}</span></span>
                    </span>
                  </>
                );
                const clase = `ruta-paso ${paso.lista ? 'lista' : ''}`;
                return paso.to ? <Link to={paso.to} className={clase}>{contenido}</Link> : <span className={clase}>{contenido}</span>;
              })()}
            </li>
          ))}
        </ol>
      </section>}

      <div className="row g-4">
        <div className={verAuditoria ? 'col-xl-7' : 'col-12'}>
          {verGuia && <section className="card-flv p-3 p-md-4 mb-4" aria-labelledby="titulo-pendientes">
            <h2 id="titulo-pendientes" className="h5"><i className="bi bi-list-check me-1" aria-hidden="true"></i>Qué requiere tu atención</h2>
            {pendientes.length === 0 ? (
              <p className="small text-secondary-flv mb-0"><i className="bi bi-check-circle-fill me-1 text-success" aria-hidden="true"></i>Todo al día: no hay nada pendiente en esta edición.</p>
            ) : (
              <ul className="list-unstyled mb-0">
                {pendientes.map((p) => (
                  <li className="fila-pendiente" key={p.clave}>
                    <span className="d-flex gap-2"><i className={`bi bi-${p.icono} text-rojo`} aria-hidden="true"></i><span className="small">{p.texto}</span></span>
                    {p.to && <Link className="btn btn-sm btn-outline-primary text-nowrap" to={p.to}>{p.accion}</Link>}
                  </li>
                ))}
              </ul>
            )}
          </section>}
          {puede('votaciones.ver') && <section className="card-flv p-3 p-md-4" aria-labelledby="titulo-abiertas">
            <h2 id="titulo-abiertas" className="h5">Votaciones abiertas ahora</h2>
            {abiertas.length === 0 && <p className="small text-secondary-flv mb-0">No hay votaciones abiertas en esta edición.</p>}
            <ul className="list-unstyled mb-0">
              {abiertas.map((v) => {
                const total = votos.filter((x) => x.votacionId === v.id).length;
                return (
                  <li key={v.id} className="fila-pendiente">
                    <span className="small fw-semibold">{v.titulo}</span>
                    <span className="d-flex align-items-center gap-2">
                      {verVotos && <span className="small text-nowrap">{total} {total === 1 ? 'voto' : 'votos'}</span>}
                      <EstadoBadge estado={v.estado} />
                      {verVotos && <Link className="btn btn-sm btn-outline-primary text-nowrap" to="/panel/resultados" state={{ votacionId: v.id }} aria-label={`Ver votos de ${v.titulo}`}>Ver votos</Link>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>}
        </div>
        {verAuditoria && <div className="col-xl-5">
          <section className="card-flv p-3 p-md-4 h-100" aria-labelledby="titulo-auditoria">
            <h2 id="titulo-auditoria" className="h5"><i className="bi bi-clock-history me-1" aria-hidden="true"></i>Actividad reciente <span className="small fw-normal text-secondary-flv">({modo === 'api' ? 'auditoría' : 'auditoría simulada'})</span></h2>
            <ul className="list-group list-group-flush">
              {auditoria.slice(0, 8).map((a) => (
                <li className="list-group-item px-0" key={a.id}>
                  <p className="mb-0 small fw-semibold">{a.accion}</p>
                  <p className="mb-0 small text-secondary-flv">{formatearFechaHora(a.fechaHora)} · {a.usuario}</p>
                </li>
              ))}
            </ul>
            <Link to="/panel/auditoria" className="enlace-mas d-inline-block mt-2">Ver toda la auditoría <i className="bi bi-arrow-right" aria-hidden="true"></i></Link>
          </section>
        </div>}
      </div>
    </>
  );
}
