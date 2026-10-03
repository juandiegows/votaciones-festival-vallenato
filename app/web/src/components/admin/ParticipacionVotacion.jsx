import { useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { useConsultaEnVivo } from '../../hooks/useConsultaEnVivo.js';
import { formatearFecha } from '../../utils/helpers.js';
import TablaResponsiva from '../TablaResponsiva.jsx';

/**
 * Quién votó (nunca por qué opción). Mientras la votación está abierta la lista solo aparece en
 * bloques completos de 10 votantes, en orden alfabético y sin hora, para que no se pueda deducir
 * el voto de las primeras personas comparando con los resultados en vivo.
 */
export default function ParticipacionVotacion({ votacionId, intervalo = 0 }) {
  const { obtenerParticipacion } = useApp();
  const [filtro, setFiltro] = useState('');
  const { datos, error, cargando } = useConsultaEnVivo(() => obtenerParticipacion(votacionId), [votacionId], { intervalo, activa: !!votacionId });

  if (error) return <div className="alert alert-danger mb-0" role="alert">{error}</div>;
  if (!datos) {
    return <p className="mb-0" role="status"><span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Cargando participación…</p>;
  }

  const texto = filtro.trim().toLowerCase();
  const lista = texto ? datos.votantes.filter((v) => `${v.nombre} ${v.correo}`.toLowerCase().includes(texto)) : datos.votantes;

  return (
    <div aria-busy={cargando}>
      <div className="d-flex flex-wrap gap-3 mb-2 small">
        <span><strong>{datos.totalVotantes.toLocaleString('es-CO')}</strong> votantes</span>
        <span><strong>{datos.totalVotos.toLocaleString('es-CO')}</strong> votos</span>
        {datos.ocultos > 0 && <span className="text-secondary-flv"><i className="bi bi-eye-slash me-1" aria-hidden="true"></i>{datos.ocultos} aún sin mostrar</span>}
      </div>
      <p className="small text-secondary-flv mb-2">
        <i className="bi bi-shield-lock me-1" aria-hidden="true"></i>
        Se muestra quién votó, nunca por qué opción.{' '}
        {datos.estado === 'cerrada'
          ? 'Votación cerrada: lista completa.'
          : `Mientras esté abierta, la lista se revela en grupos de ${datos.umbral} y en orden alfabético.`}
      </p>
      {!datos.disponible ? (
        <div className="alert aviso-crema mb-0 small" role="note">
          <i className="bi bi-hourglass-split me-1" aria-hidden="true"></i>{datos.motivo}
        </div>
      ) : (
        <>
          <label htmlFor={`buscar-votante-${votacionId}`} className="visually-hidden">Buscar votante</label>
          <input id={`buscar-votante-${votacionId}`} type="search" className="form-control form-control-sm mb-2" placeholder="Buscar por nombre o correo" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
          <TablaResponsiva
            titulo="Personas que votaron"
            claseContenedor="participacion-tabla"
            claseTabla="table-sm"
            filas={lista}
            clave={(v) => v.id}
            nombreFila={(v) => v.nombre}
            vacio="Sin coincidencias."
            columnas={[
              { id: 'votante', titulo: 'Votante', celda: (v) => v.nombre, claseTd: 'small', minimo: '9rem', prioridad: 0 },
              { id: 'correo', titulo: 'Correo', celda: (v) => v.correo, claseTd: 'small text-break', prioridad: 2 },
              { id: 'fecha', titulo: 'Fecha', celda: (v) => formatearFecha(v.fecha), claseTd: 'small text-nowrap', prioridad: 1 },
            ]}
          />
        </>
      )}
    </div>
  );
}
