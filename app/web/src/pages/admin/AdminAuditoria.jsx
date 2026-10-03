import { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { useEdicionAdmin } from '../../context/EdicionAdmin.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import EstadoBadge from '../../components/EstadoBadge.jsx';
import IndicadorEnVivo from '../../components/admin/IndicadorEnVivo.jsx';
import IntegridadVotos from '../../components/admin/IntegridadVotos.jsx';
import ParticipacionVotacion from '../../components/admin/ParticipacionVotacion.jsx';
import SelectorVista, { useVistaGuardada } from '../../components/SelectorVista.jsx';
import { INTERVALO_EN_VIVO, useConsultaEnVivo } from '../../hooks/useConsultaEnVivo.js';
import { formatearFechaHora } from '../../utils/helpers.js';
import TablaResponsiva from '../../components/TablaResponsiva.jsx';

const PESTANAS = [
  { id: 'participacion', label: 'Quién votó', icono: 'people' },
  { id: 'integridad', label: 'Integridad de votos', icono: 'shield-check' },
  { id: 'autoria', label: 'Autoría de registros', icono: 'person-badge' },
  { id: 'acciones', label: 'Acciones de administración', icono: 'clock-history' },
];

// Filtros de la API (en el modo demostración se busca por texto)
const ENTIDADES = [
  ['', 'Todo'],
  ['edicion', 'Ediciones'],
  ['categoria', 'Categorías'],
  ['votacion', 'Votaciones'],
  ['opcion', 'Opciones'],
  ['banner', 'Banners'],
  ['red_social', 'Redes sociales'],
  ['configuracion', 'Configuración del sitio'],
];

function Participacion({ intervalo }) {
  const { categorias, votaciones, votos } = useEdicionAdmin();
  const publicadas = votaciones.filter((v) => v.publicada);
  const [seleccion, setSeleccion] = useState('');
  const votacion = publicadas.find((v) => v.id === Number(seleccion)) || publicadas[0];

  if (!votacion) return <div className="card-flv p-4 text-center">Esta edición no tiene votaciones publicadas.</div>;
  return (
    <div className="row g-3">
      <div className="col-lg-5">
        <div className="card-flv p-2">
          <ul className="list-group list-group-flush" aria-label="Votaciones de la edición">
            {publicadas.map((v) => {
              const n = votos.filter((x) => x.votacionId === v.id).length;
              const activa = v.id === votacion.id;
              return (
                <li key={v.id} className="list-group-item p-0 border-0">
                  <button type="button" className={`btn w-100 text-start d-flex justify-content-between align-items-center gap-2 boton-votacion-auditoria ${activa ? 'activa' : ''}`} aria-pressed={activa} onClick={() => setSeleccion(String(v.id))}>
                    <span>
                      <span className="d-block fw-semibold small">{v.titulo}</span>
                      <span className="d-block small text-secondary-flv">{categorias.find((c) => c.id === v.categoriaId)?.nombre}</span>
                    </span>
                    <span className="d-flex flex-column align-items-end gap-1">
                      <EstadoBadge estado={v.estado} />
                      <span className="small text-nowrap">{n} {n === 1 ? 'voto' : 'votos'}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <div className="col-lg-7">
        <section className="card-flv p-3 p-md-4" aria-labelledby="titulo-quien-voto">
          <h2 id="titulo-quien-voto" className="h6">{votacion.titulo}</h2>
          <ParticipacionVotacion votacionId={votacion.id} intervalo={intervalo} />
        </section>
      </div>
    </div>
  );
}

function Integridad({ intervalo }) {
  const { obtenerIntegridad } = useApp();
  const { edicion } = useEdicionAdmin();
  const { datos, error } = useConsultaEnVivo(() => obtenerIntegridad(edicion.id), [edicion?.id], { intervalo, activa: !!edicion });
  if (error) return <div className="alert alert-danger" role="alert">{error}</div>;
  if (!datos) return <p role="status"><span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Verificando votos…</p>;
  return <IntegridadVotos integridad={datos} />;
}

// Tipos de registro de la autoría (columnas de soporte creado_por / actualizado_por)
const TIPOS_REGISTRO = {
  edicion: 'Edición',
  categoria: 'Categoría',
  votacion: 'Votación',
  opcion: 'Opción',
  banner: 'Banner',
  revista: 'Revista',
  red_social: 'Red social',
  configuracion: 'Configuración',
};

function Autor({ nombre, fecha }) {
  return (
    <>
      <span className="d-block text-break">{nombre || <span className="text-secondary-flv">Sistema (carga de datos)</span>}</span>
      <span className="d-block text-secondary-flv text-nowrap">{formatearFechaHora(fecha)}</span>
    </>
  );
}

function Autoria() {
  const { obtenerAutoria, version } = useApp();
  const { edicion } = useEdicionAdmin();
  const [tipo, setTipo] = useState('');
  const [buscar, setBuscar] = useState('');
  const [estado, setEstado] = useState({ cargando: true, registros: [], error: '' });

  useEffect(() => {
    let vigente = true;
    setEstado((e) => ({ ...e, cargando: true }));
    obtenerAutoria(edicion.id).then((r) => {
      if (vigente) setEstado(r.ok ? { cargando: false, registros: r.registros, error: '' } : { cargando: false, registros: [], error: r.error });
    });
    return () => {
      vigente = false;
    };
  }, [obtenerAutoria, edicion.id, version]);

  const { cargando, registros, error } = estado;
  const texto = buscar.trim().toLowerCase();
  const visibles = registros.filter(
    (r) => (!tipo || r.entidad === tipo) && (!texto || `${r.nombre} ${r.creadoPor || ''} ${r.actualizadoPor || ''}`.toLowerCase().includes(texto))
  );
  if (error) return <div className="alert alert-info" role="status">{error}</div>;
  return (
    <>
      <div className="card-flv p-3 mb-3">
        <div className="row g-2">
          <div className="col-md-7">
            <label htmlFor="aut-buscar" className="form-label small mb-1">Buscar</label>
            <input id="aut-buscar" type="search" className="form-control form-control-sm" placeholder="Registro o usuario" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          </div>
          <div className="col-md-5">
            <label htmlFor="aut-tipo" className="form-label small mb-1">Tipo de registro</label>
            <select id="aut-tipo" className="form-select form-select-sm" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(TIPOS_REGISTRO).map(([v, e]) => <option key={v} value={v}>{e}</option>)}
            </select>
          </div>
        </div>
      </div>
      <TablaResponsiva
        titulo="Autoría de los registros: quién los creó y quién los modificó por última vez"
        filas={visibles}
        clave={(r) => r.clave}
        nombreFila={(r) => r.nombre}
        ocupado={cargando}
        vacio={!cargando && 'No hay registros con ese filtro.'}
        columnas={[
          {
            id: 'registro', titulo: 'Registro', claseTd: 'small', minimo: '11rem', prioridad: 0,
            celda: (r) => (
              <>
                <span className="d-block text-secondary-flv">{TIPOS_REGISTRO[r.entidad] || r.entidad}</span>
                <span className="d-block fw-semibold">{r.nombre}</span>
              </>
            ),
          },
          { id: 'creado', titulo: 'Creado por', celda: (r) => <Autor nombre={r.creadoPor} fecha={r.creadoEn} />, claseTd: 'small', prioridad: 2 },
          { id: 'actualizado', titulo: 'Última modificación', celda: (r) => <Autor nombre={r.actualizadoPor} fecha={r.actualizadoEn} />, claseTd: 'small', prioridad: 1 },
        ]}
      />
      <p className="small text-secondary-flv mt-2 mb-0" aria-live="polite">
        {cargando ? 'Cargando…' : `${visibles.length.toLocaleString('es-CO')} registros · lo modificado más recientemente primero`}
      </p>
    </>
  );
}

function Acciones() {
  const { cargarAuditoria, version, modo } = useApp();
  const [pagina, setPagina] = useState(1);
  const [buscar, setBuscar] = useState('');
  const [entidad, setEntidad] = useState('');
  const [vista, setVista] = useVistaGuardada('auditoria', 'tabla');
  const [estado, setEstado] = useState({ cargando: true, registros: [], total: 0, hayMas: false, error: '' });

  useEffect(() => {
    let vigente = true;
    setEstado((e) => ({ ...e, cargando: true }));
    const t = setTimeout(() => {
      cargarAuditoria(pagina, { q: buscar, entidad }).then((r) => {
        if (!vigente) return;
        setEstado(r.ok ? { cargando: false, ...r, error: '' } : { cargando: false, registros: [], total: 0, hayMas: false, error: r.error });
      });
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, version, buscar, entidad]);

  const { cargando, registros, total, hayMas, error } = estado;
  return (
    <>
      <div className="card-flv p-3 mb-3">
        <div className="row g-2">
          <div className={modo === 'api' ? 'col-md-6' : 'col-md'}>
            <label htmlFor="aud-buscar" className="form-label small mb-1">Buscar</label>
            <input id="aud-buscar" type="search" className="form-control form-control-sm" placeholder="Usuario o acción (crear, publicar, eliminar…)" value={buscar} onChange={(e) => { setBuscar(e.target.value); setPagina(1); }} />
          </div>
          {modo === 'api' && (
            <div className="col-md-4">
              <label htmlFor="aud-entidad" className="form-label small mb-1">Sobre</label>
              <select id="aud-entidad" className="form-select form-select-sm" value={entidad} onChange={(e) => { setEntidad(e.target.value); setPagina(1); }}>
                {ENTIDADES.map(([v, e]) => <option key={v} value={v}>{e}</option>)}
              </select>
            </div>
          )}
          <div className="col-md-auto d-flex align-items-end">
            <SelectorVista valor={vista} onCambio={setVista} />
          </div>
        </div>
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {!cargando && registros.length === 0 && vista !== 'tabla' && (
        <div className="card-flv p-4 text-center">No hay acciones registradas con ese filtro.</div>
      )}
      {vista === 'tarjetas' && (
        <div className="row g-3" aria-busy={cargando}>
          {registros.map((a) => (
            <div className="col-md-6 col-xl-4" key={a.id}>
              <article className="card-flv h-100 p-3">
                <p className="mb-2">{a.accion}</p>
                <div className="d-flex flex-wrap justify-content-between gap-2 small text-secondary-flv border-top pt-2">
                  <span className="text-break"><i className="bi bi-person me-1" aria-hidden="true"></i>{a.usuario}</span>
                  <span className="text-nowrap"><i className="bi bi-clock me-1" aria-hidden="true"></i>{formatearFechaHora(a.fechaHora)}</span>
                </div>
              </article>
            </div>
          ))}
        </div>
      )}
      {vista === 'mosaico' && (
        <div className="row g-2 vista-mosaico" aria-busy={cargando}>
          {registros.map((a) => (
            <div className="col-sm-6 col-lg-4 col-xxl-3" key={a.id}>
              <article className="card-flv h-100 small">
                <span className="d-block text-secondary-flv text-nowrap mb-1">{formatearFechaHora(a.fechaHora)}</span>
                <span className="d-block fw-semibold mb-1">{a.accion}</span>
                <span className="d-block text-secondary-flv text-truncate">{a.usuario}</span>
              </article>
            </div>
          ))}
        </div>
      )}
      {vista === 'lista' && (
        <ul className="list-unstyled d-grid gap-2 mb-0" aria-busy={cargando}>
          {registros.map((a) => (
            <li key={a.id} className="card-flv p-3 d-flex align-items-center gap-3">
              <span className="icono-circulo icono-sm"><i className="bi bi-clock-history" aria-hidden="true"></i></span>
              <div className="flex-grow-1">
                <span className="d-block">{a.accion}</span>
                <span className="small text-secondary-flv text-break">{a.usuario} · {formatearFechaHora(a.fechaHora)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      {vista === 'compacta' && registros.length > 0 && (
        <ul className="list-unstyled lista-compacta mb-0" aria-busy={cargando}>
          {registros.map((a) => (
            <li key={a.id}>
              <span className="text-secondary-flv text-nowrap">{formatearFechaHora(a.fechaHora)}</span>
              <span className="flex-grow-1 text-truncate">{a.accion}</span>
              <span className="d-none d-md-inline text-secondary-flv text-truncate" style={{ maxWidth: '14rem' }}>{a.usuario}</span>
            </li>
          ))}
        </ul>
      )}
      {vista === 'tabla' && (
        <TablaResponsiva
          titulo={`Registro de auditoría, página ${pagina}`}
          filas={registros}
          clave={(a) => a.id}
          nombreFila={(a) => a.accion}
          ocupado={cargando}
          vacio={!cargando && 'No hay acciones registradas con ese filtro.'}
          columnas={[
            { id: 'fecha', titulo: 'Fecha y hora', celda: (a) => formatearFechaHora(a.fechaHora), claseTd: 'small text-nowrap', prioridad: 1 },
            { id: 'usuario', titulo: 'Usuario', celda: (a) => a.usuario, claseTd: 'small text-break', prioridad: 2 },
            { id: 'accion', titulo: 'Acción', celda: (a) => a.accion, claseTd: 'small', minimo: '11rem', prioridad: 0 },
          ]}
        />
      )}
      <nav className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3" aria-label="Paginación de la auditoría">
        <span className="small text-secondary-flv" aria-live="polite">
          {cargando ? 'Cargando…' : `${total.toLocaleString('es-CO')} registros · página ${pagina}`}
        </span>
        <div className="btn-group">
          <button type="button" className="btn btn-sm btn-outline-primary" disabled={pagina === 1 || cargando} onClick={() => setPagina((p) => p - 1)}>
            <i className="bi bi-chevron-left me-1" aria-hidden="true"></i>Anterior
          </button>
          <button type="button" className="btn btn-sm btn-outline-primary" disabled={!hayMas || cargando} onClick={() => setPagina((p) => p + 1)}>
            Siguiente<i className="bi bi-chevron-right ms-1" aria-hidden="true"></i>
          </button>
        </div>
      </nav>
    </>
  );
}

export default function AdminAuditoria() {
  const { edicion } = useEdicionAdmin();
  const [pestana, setPestana] = useState('participacion');
  const [enVivo, setEnVivo] = useState(false);
  const intervalo = enVivo ? INTERVALO_EN_VIVO : 0;

  return (
    <>
      <PageHeader
        titulo="Auditoría"
        subtitulo={`${edicion ? `${edicion.nombre} · ` : ''}Quién votó, verificación de que los votos cuadren, quién creó y modificó cada registro y todo lo que hace la administración.`}
      >
        {(pestana === 'participacion' || pestana === 'integridad') && <IndicadorEnVivo id="aud-en-vivo" activo={enVivo} onCambio={setEnVivo} />}
      </PageHeader>
      <ul className="nav nav-tabs mb-3" role="tablist">
        {PESTANAS.map((p) => (
          <li className="nav-item" role="presentation" key={p.id}>
            <button type="button" role="tab" id={`tab-${p.id}`} aria-selected={pestana === p.id} aria-controls={`panel-${p.id}`} className={`nav-link ${pestana === p.id ? 'active' : ''}`} onClick={() => setPestana(p.id)}>
              <i className={`bi bi-${p.icono} me-1`} aria-hidden="true"></i>{p.label}
            </button>
          </li>
        ))}
      </ul>
      <div role="tabpanel" id={`panel-${pestana}`} aria-labelledby={`tab-${pestana}`}>
        {!edicion && pestana !== 'acciones' ? (
          <div className="alert alert-info">Crea una edición para ver esta información.</div>
        ) : pestana === 'participacion' ? (
          <Participacion intervalo={intervalo} />
        ) : pestana === 'integridad' ? (
          <Integridad intervalo={intervalo} />
        ) : pestana === 'autoria' ? (
          <Autoria />
        ) : (
          <Acciones />
        )}
      </div>
    </>
  );
}
