/**
 * Datos de demostración (ILUSTRATIVOS).
 * Las categorías, votaciones y opciones NO han sido confirmadas por la Fundación
 * Festival de la Leyenda Vallenata: son ejemplos para el prototipo de la Entrega 1.
 * Todos los nombres de personas, canciones y agrupaciones son ficticios.
 *
 * Modelo: EDICIÓN → CATEGORÍA → VOTACIÓN → OPCIÓN → VOTO, más USUARIO.
 * Las fechas de las votaciones se calculan relativas al momento en que se
 * generan los datos, para que siempre existan votaciones abiertas, programadas
 * y cerradas al navegar el prototipo.
 */
import { generarCodigoComprobante, slugificar } from '../utils/helpers.js';

const DIA = 24 * 60 * 60 * 1000;

function relativa(dias, horas = 0) {
  const d = new Date(Date.now() + dias * DIA + horas * 60 * 60 * 1000);
  d.setSeconds(0, 0);
  return d.toISOString();
}

// Generador pseudoaleatorio determinista (para que los votos semilla sean estables)
function crearRandom(semilla) {
  let s = semilla;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function crearDatosSemilla() {
  const ediciones = [
    {
      id: 1,
      nombre: 'Festival de la Leyenda Vallenata 2027',
      anio: 2027,
      fechaInicio: '2027-04-28',
      fechaFin: '2027-05-02',
      estado: 'activa',
    },
    {
      id: 2,
      nombre: 'Festival de la Leyenda Vallenata 2026',
      anio: 2026,
      fechaInicio: '2026-04-29',
      fechaFin: '2026-05-03',
      estado: 'cerrada',
    },
  ];

  const anioActivo = ediciones[0].anio;

  const categorias = [
    { id: 1, edicionId: 1, nombre: 'Música', descripcion: 'Votaciones del público sobre las canciones que suenan en el Festival.', icono: 'music-note-beamed', activa: true, orden: 1 },
    { id: 2, edicionId: 1, nombre: 'Piloneras', descripcion: 'Las comparsas que llenan de color el desfile de Piloneras.', icono: 'people-fill', activa: true, orden: 2 },
    { id: 3, edicionId: 1, nombre: 'Vestuario', descripcion: 'El vestuario típico que representa la tradición del Cesar.', icono: 'stars', activa: true, orden: 3 },
    { id: 4, edicionId: 1, nombre: 'Agrupaciones', descripcion: 'Conjuntos vallenatos que se presentan en las tarimas del Festival.', icono: 'boombox-fill', activa: true, orden: 4 },
    { id: 5, edicionId: 1, nombre: 'Reconocimientos del público', descripcion: 'Personajes que el público quiere destacar en esta edición.', icono: 'award-fill', activa: true, orden: 5 },
  ];

  categorias.forEach((c) => {
    c.slug = slugificar(c.nombre);
  });

  const base = { votosPorUsuario: 1, cerradaManualmente: false, publicada: true, resultadosPublicados: false };

  const votaciones = [
    { ...base, id: 1, categoriaId: 1, titulo: 'Canción favorita del público', descripcion: 'Elige la canción que más te ha gustado entre las finalistas de la convocatoria del público.', fechaApertura: relativa(-6), fechaCierre: relativa(9, 5), mostrarResultados: 'en tiempo real', imagen: 'music-note-beamed' },
    { ...base, id: 2, categoriaId: 1, titulo: 'Canción inédita revelación', descripcion: 'Votación del público entre canciones inéditas presentadas en la edición.', fechaApertura: relativa(-25), fechaCierre: relativa(-3), mostrarResultados: 'al cerrar', imagen: 'vinyl-fill' },
    { ...base, id: 3, categoriaId: 2, titulo: 'Mejor comparsa de Piloneras', descripcion: 'Escoge la comparsa con mejor coreografía, alegría y representación de la tradición.', fechaApertura: relativa(-3), fechaCierre: relativa(5, 2), mostrarResultados: 'al cerrar', imagen: 'people-fill' },
    { ...base, id: 4, categoriaId: 3, titulo: 'Mejor vestuario típico', descripcion: 'Vota por la propuesta de vestuario que mejor representa la cultura vallenata.', fechaApertura: relativa(12), fechaCierre: relativa(20), mostrarResultados: 'al cerrar', imagen: 'stars' },
    { ...base, id: 5, categoriaId: 4, titulo: 'Agrupación favorita', descripcion: 'Selecciona la agrupación que más te ha hecho vibrar en tarima.', fechaApertura: relativa(-2), fechaCierre: relativa(12), mostrarResultados: 'no publicar', imagen: 'boombox-fill' },
    { ...base, id: 6, categoriaId: 4, titulo: 'Mejor agrupación juvenil', descripcion: 'Reconocimiento del público a los semilleros y agrupaciones juveniles.', fechaApertura: relativa(15), fechaCierre: relativa(25), mostrarResultados: 'en tiempo real', imagen: 'music-player-fill' },
    { ...base, id: 7, categoriaId: 5, titulo: 'Personaje del Festival', descripcion: 'El público elige al personaje que mejor representa el espíritu del Festival.', fechaApertura: relativa(-30), fechaCierre: relativa(-8), mostrarResultados: 'al cerrar', imagen: 'award-fill' },
    // Borrador sin publicar: tiene una sola opción (sirve para demostrar RN-06)
    { ...base, id: 8, categoriaId: 1, titulo: 'Mejor acordeonero aficionado', descripcion: 'Votación en preparación. Requiere al menos 2 opciones para publicarse.', fechaApertura: relativa(30), fechaCierre: relativa(40), mostrarResultados: 'al cerrar', imagen: 'music-note', publicada: false },
  ];

  votaciones.forEach((v) => {
    v.slug = slugificar(v.titulo);
  });

  // Muestras instrumentales ORIGINALES generadas para el proyecto (public/audio/muestras/), en el orden de las opciones.
  const muestras = {
    1: ['brisas-del-guatapuri', 'luna-de-valledupar', 'el-pilon-de-mi-tierra', 'sabanas-del-cesar', 'caminos-de-la-sierra'],
    2: ['corazon-sabanero', 'recuerdos-de-mi-pueblo', 'la-brisa-y-el-acordeon', 'cantor-de-mi-tierra'],
  };

  const nombresOpciones = {
    1: [
      ["Canción A – 'Brisas del Guatapurí' (ficticia)", 'Paseo vallenato sobre los recuerdos del río.'],
      ["Canción B – 'Luna de Valledupar' (ficticia)", 'Merengue romántico con aires de serenata.'],
      ["Canción C – 'El Pilón de mi Tierra' (ficticia)", 'Puya alegre inspirada en las fiestas populares.'],
      ["Canción D – 'Sabanas del Cesar' (ficticia)", 'Son que describe los paisajes de la región.'],
      ["Canción E – 'Caminos de la Sierra' (ficticia)", 'Paseo que narra un viaje a la Sierra Nevada.'],
    ],
    2: [
      ["'Corazón Sabanero' (ficticia)", 'Canción inédita, aire de paseo.'],
      ["'Recuerdos de Mi Pueblo' (ficticia)", 'Canción inédita, aire de son.'],
      ["'La Brisa y el Acordeón' (ficticia)", 'Canción inédita, aire de merengue.'],
      ["'Cantor de Mi Tierra' (ficticia)", 'Canción inédita, aire de puya.'],
    ],
    3: [
      ['Comparsa Las Marías del Valle', 'Grupo de 40 bailarinas con coreografía tradicional.'],
      ['Comparsa Pilón de Oro', 'Comparsa familiar con tres generaciones de piloneros.'],
      ['Comparsa Raíces del Cesar', 'Propuesta que rinde homenaje a la vida campesina.'],
      ['Comparsa Mujeres del Guatapurí', 'Colectivo de mujeres con vestuario artesanal.'],
      ['Comparsa Juventud Pilonera', 'Semillero de jóvenes de colegios de la ciudad.'],
    ],
    4: [
      ['Propuesta 1 – Pollera y camisa campesina', 'Vestuario tradicional con estampado floral.'],
      ['Propuesta 2 – Atuendo del cantor sabanero', 'Sombrero vueltiao, mochila y guayabera.'],
      ['Propuesta 3 – Homenaje a la Sierra Nevada', 'Inspirado en los tejidos de la región.'],
      ['Propuesta 4 – Colores del Pilón', 'Polleras de colores vivos para el desfile.'],
    ],
    5: [
      ['Los Juglares del Valle (ficticia)', 'Agrupación con acordeón, caja y guacharaca.'],
      ['Conjunto Acordeón y Caja (ficticio)', 'Conjunto tradicional de la provincia.'],
      ['Los Herederos de la Sierra (ficticia)', 'Agrupación de música vallenata clásica.'],
      ['Agrupación Sabana Nueva (ficticia)', 'Nueva ola vallenata con fusión.'],
      ['Los Parranderos del Río (ficticia)', 'Agrupación de parranda y tradición oral.'],
      ['Conjunto Tierra de Cantores (ficticio)', 'Conjunto de cantores y compositores.'],
    ],
    6: [
      ['Semillero Notas del Mañana (ficticio)', 'Niños y jóvenes de 10 a 17 años.'],
      ['Los Pequeños Juglares (ficticio)', 'Agrupación infantil de acordeoneros.'],
      ['Agrupación Raíz Joven (ficticia)', 'Jóvenes intérpretes de aires tradicionales.'],
    ],
    7: [
      ['Rosa Elvira Cantillo (ficticia) – Cantadora', 'Guardiana de la tradición oral vallenata.'],
      ['Aurelio Mendoza Ruiz (ficticio) – Decimero', 'Compositor de décimas y versos improvisados.'],
      ['Ana Lucía Daza Pérez (ficticia) – Gestora cultural', 'Impulsora de escuelas de música.'],
      ['Ramiro Arias Gutiérrez (ficticio) – Luthier', 'Artesano que repara acordeones y cajas.'],
    ],
    8: [['Participante 1 (ficticio)', 'Única opción registrada hasta ahora.']],
  };

  const opciones = [];
  let opcionId = 1;
  Object.entries(nombresOpciones).forEach(([votacionId, lista]) => {
    lista.forEach(([nombre, descripcion], i) => {
      opciones.push({
        id: opcionId++,
        votacionId: Number(votacionId),
        nombre,
        descripcion,
        enlaceMultimedia: muestras[votacionId] ? `/audio/muestras/${muestras[votacionId][i]}.mp3` : '',
        orden: i + 1,
      });
    });
  });

  // NOTA: las contraseñas en texto plano son SOLO para el prototipo (mock).
  // En la versión real se almacenarán con hash (p. ej. PBKDF2 de Django).
  const usuarios = [
    { id: 1, nombres: 'Administrador', apellidos: 'Festival', correo: 'admin@festival.test', contrasena: 'Admin2027*', rol: 'administrador', aceptaTratamientoDatos: true, fechaRegistro: relativa(-60) },
    { id: 2, nombres: 'Valentina', apellidos: 'Ospino Carrillo', correo: 'votante@festival.test', contrasena: 'Voto2027*', rol: 'votante', aceptaTratamientoDatos: true, fechaRegistro: relativa(-20) },
  ];

  // Votantes ficticios para que los resultados tengan datos
  const nombres = ['Andrés', 'Camila', 'Luis', 'Daniela', 'Jorge', 'Mariana', 'Carlos', 'Laura', 'Felipe', 'Paola', 'Sergio', 'Natalia', 'Diego', 'Juliana', 'Óscar', 'Yuliana'];
  const apellidos = ['Quintero', 'Barros', 'Zuleta', 'Romero', 'Castro', 'Fuentes', 'Ariza', 'Molina', 'Peñaloza', 'Vega', 'Suárez', 'Montaño'];
  const rnd = crearRandom(2027);
  for (let i = 0; i < 118; i++) {
    const n = nombres[i % nombres.length];
    const a = apellidos[Math.floor(rnd() * apellidos.length)];
    usuarios.push({
      id: 100 + i,
      nombres: n,
      apellidos: a,
      correo: `${n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')}.${a.toLowerCase().replace('ñ', 'n')}${i}@correo.test`,
      contrasena: 'Demo2027*',
      rol: 'votante',
      aceptaTratamientoDatos: true,
      fechaRegistro: relativa(-Math.floor(rnd() * 40) - 1),
    });
  }

  // Pesos para que haya un ganador claro en cada votación
  const pesos = { 1: [5, 3, 4, 2, 1], 2: [2, 5, 3, 2], 3: [4, 3, 2, 5, 2], 5: [3, 4, 2, 3, 1, 2], 7: [5, 3, 2, 2] };
  const votos = [];
  let votoId = 1;
  Object.entries(pesos).forEach(([vId, w]) => {
    const votacion = votaciones.find((v) => v.id === Number(vId));
    const ops = opciones.filter((o) => o.votacionId === votacion.id);
    const total = w.reduce((s, x) => s + x, 0);
    const desde = new Date(votacion.fechaApertura).getTime();
    const hasta = Math.min(new Date(votacion.fechaCierre).getTime(), Date.now() - 60 * 60 * 1000);
    usuarios.forEach((u) => {
      if (u.id < 100 || rnd() < 0.3) return; // ~70 % de participación
      let r = rnd() * total;
      let idx = 0;
      while (r > w[idx]) { r -= w[idx]; idx++; }
      votos.push({
        id: votoId++,
        usuarioId: u.id,
        votacionId: votacion.id,
        opcionId: ops[idx].id,
        fechaHora: new Date(desde + rnd() * (hasta - desde)).toISOString(),
        codigoComprobante: generarCodigoComprobante(anioActivo),
      });
    });
  });

  // La votante demo ya votó en una votación cerrada (para "Mis votos")
  votos.push({
    id: votoId++,
    usuarioId: 2,
    votacionId: 7,
    opcionId: opciones.find((o) => o.votacionId === 7).id,
    fechaHora: relativa(-12),
    codigoComprobante: 'FLV27-8F3K2A',
  });

  const auditoria = [
    { id: 1, fechaHora: relativa(-6), usuario: 'admin@festival.test', accion: 'Abrió la votación "Canción favorita del público"' },
    { id: 2, fechaHora: relativa(-3), usuario: 'admin@festival.test', accion: 'Cerró la votación "Canción inédita revelación"' },
    { id: 3, fechaHora: relativa(-3, 1), usuario: 'admin@festival.test', accion: 'Abrió la votación "Mejor comparsa de Piloneras"' },
    { id: 4, fechaHora: relativa(-2), usuario: 'admin@festival.test', accion: 'Creó la votación "Mejor agrupación juvenil"' },
    { id: 5, fechaHora: relativa(-1), usuario: 'admin@festival.test', accion: 'Actualizó la categoría "Vestuario"' },
  ];

  return { ediciones, categorias, votaciones, opciones, usuarios, votos, auditoria };
}
