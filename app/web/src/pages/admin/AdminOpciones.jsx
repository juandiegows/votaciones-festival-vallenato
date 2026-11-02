import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import EstadoBadge from '../../components/EstadoBadge.jsx';
import IconoEntidad from '../../components/IconoEntidad.jsx';
import NoEncontrado from '../NoEncontrado.jsx';
import FormularioOpcion, { opcionNueva } from '../../components/admin/FormularioOpcion.jsx';
import OpcionesAdmin from '../../components/admin/OpcionesAdmin.jsx';
import { presentacionOpciones } from '../../data/presentaciones.js';
import { AVISO_OPCIONES_BLOQUEADAS, opcionesBloqueadas } from '../../utils/helpers.js';
import { opcionesActivas } from '../../utils/guiaPanel.js';

export default function AdminOpciones() {
  const { id } = useParams();
  const { votaciones, opciones, votos, categorias, guardarEntidad } = useApp();
  const [form, setForm] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [publicando, setPublicando] = useState(false);

  const votacion = votaciones.find((v) => v.id === Number(id));
  if (!votacion) return <NoEncontrado mensaje="La votación no existe." />;
  const lista = opciones.filter((o) => o.votacionId === votacion.id);
  const categoria = categorias.find((c) => c.id === votacion.categoriaId);
  const presentacion = presentacionOpciones(votacion.presentacionOpciones);
  const bloqueada = opcionesBloqueadas(votacion, votos);
  const activas = opcionesActivas(opciones, votacion.id);

  const publicar = async () => {
    setPublicando(true);
    const r = await guardarEntidad('votaciones', { id: votacion.id, publicada: true }, `Publicó la votación "${votacion.titulo}"`);
    setPublicando(false);
    setMensaje(r.ok ? { tipo: 'success', texto: `Votación «${votacion.titulo}» publicada.` } : { tipo: 'danger', texto: `No se puede publicar «${votacion.titulo}»: ${r.error}` });
  };

  return (
    <>
      <PageHeader
        titulo="Gestión de opciones"
        subtitulo={`${votacion.titulo} · ${categoria?.nombre}`}
        migas={[{ label: 'Votaciones', to: '/panel/votaciones' }, { label: votacion.titulo }, { label: 'Opciones' }]}
      >
        <button className="btn btn-primary" onClick={() => setForm(opcionNueva(votacion, lista.length + 1))} disabled={bloqueada}
          title={bloqueada ? 'Opciones bloqueadas' : undefined}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>Agregar opción
        </button>
      </PageHeader>

      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        <span className="icono-circulo icono-sm"><IconoEntidad icono={votacion.imagen || categoria?.icono} imagen={votacion.iconoImagen} /></span>
        {votacion.publicada ? <EstadoBadge estado={votacion.estado} /> : <span className="badge text-bg-secondary">Borrador</span>}
        <span className="small">{lista.length} opciones · {votos.filter((v) => v.votacionId === votacion.id).length} votos</span>
        <span className="small text-secondary-flv">
          · El público las ve como <strong><i className={`bi bi-${presentacion.icono} me-1`} aria-hidden="true"></i>{presentacion.etiqueta}</strong>
        </span>
      </div>

      {bloqueada && (
        <div className="alert alert-warning" role="status">
          <i className="bi bi-lock-fill me-1" aria-hidden="true"></i>
          {AVISO_OPCIONES_BLOQUEADAS} Si hay un error, cierra la votación y crea una nueva.
        </div>
      )}
      {!votacion.publicada && activas < 2 && (
        <div className="alert alert-warning" role="status">
          <i className="bi bi-list-ol me-1" aria-hidden="true"></i>
          <strong>Siguiente paso:</strong> agrega {activas === 0 ? '2 opciones activas' : '1 opción activa más'}. Se necesitan al menos 2 para publicar.
        </div>
      )}
      {!votacion.publicada && activas >= 2 && (
        <div className="alert alert-success d-flex flex-wrap justify-content-between align-items-center gap-2" role="status">
          <span><i className="bi bi-check-circle-fill me-1" aria-hidden="true"></i><strong>Lista para publicar.</strong> Tiene {activas} opciones activas y el público aún no la ve.</span>
          <button type="button" className="btn btn-sm btn-dorado" disabled={publicando} onClick={publicar}><i className="bi bi-megaphone me-1" aria-hidden="true"></i>Publicar votación</button>
        </div>
      )}
      {mensaje && (
        <div className={`alert alert-${mensaje.tipo} alert-dismissible`} role="status">
          {mensaje.texto}
          <button type="button" className="btn-close" aria-label="Cerrar mensaje" onClick={() => setMensaje(null)}></button>
        </div>
      )}

      <OpcionesAdmin votacion={votacion} onEditar={(o) => setForm(o)} onMensaje={setMensaje} />

      <Link to="/panel/votaciones" className="btn btn-outline-primary mt-3"><i className="bi bi-arrow-left me-1" aria-hidden="true"></i>Volver a votaciones</Link>

      <FormularioOpcion opcion={form} votacion={votacion} onCerrar={() => setForm(null)} onGuardada={(texto) => setMensaje({ tipo: 'success', texto })} />
    </>
  );
}
