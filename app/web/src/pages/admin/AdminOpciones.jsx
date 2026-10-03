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

export default function AdminOpciones() {
  const { id } = useParams();
  const { votaciones, opciones, votos, categorias } = useApp();
  const [form, setForm] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  const votacion = votaciones.find((v) => v.id === Number(id));
  if (!votacion) return <NoEncontrado mensaje="La votación no existe." />;
  const lista = opciones.filter((o) => o.votacionId === votacion.id);
  const categoria = categorias.find((c) => c.id === votacion.categoriaId);
  const presentacion = presentacionOpciones(votacion.presentacionOpciones);

  return (
    <>
      <PageHeader
        titulo="Gestión de opciones"
        subtitulo={`${votacion.titulo} · ${categoria?.nombre}`}
        migas={[{ label: 'Votaciones', to: '/panel/votaciones' }, { label: votacion.titulo }, { label: 'Opciones' }]}
      >
        <button className="btn btn-primary" onClick={() => setForm(opcionNueva(votacion, lista.length + 1))} disabled={votacion.estado === 'cerrada'}
          title={votacion.estado === 'cerrada' ? 'La votación está cerrada: no admite opciones nuevas' : undefined}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true"></i>Agregar opción
        </button>
      </PageHeader>

      <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
        <span className="icono-circulo icono-sm"><IconoEntidad icono={votacion.imagen || categoria?.icono} imagen={votacion.iconoImagen} /></span>
        <EstadoBadge estado={votacion.estado} />
        {!votacion.publicada && <span className="badge text-bg-secondary">Borrador</span>}
        <span className="small">{lista.length} opciones · {votos.filter((v) => v.votacionId === votacion.id).length} votos</span>
        <span className="small text-secondary-flv">
          · El público las ve como <strong><i className={`bi bi-${presentacion.icono} me-1`} aria-hidden="true"></i>{presentacion.etiqueta}</strong>
        </span>
      </div>

      {lista.length < 2 && (
        <div className="alert alert-warning" role="alert">
          <i className="bi bi-exclamation-triangle-fill me-1" aria-hidden="true"></i>
          Esta votación tiene {lista.length} opción(es). Se necesitan <strong>al menos 2 opciones</strong> para publicarla o abrirla.
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
