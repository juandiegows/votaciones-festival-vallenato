// Cómo se hojea la revista del inicio (se configura en /panel/revista). Los valores por defecto son el
// comportamiento de siempre: sin efecto de arrancar ni sonido. Deben coincidir con el modelo Revista de la API.
export const AJUSTES_REVISTA = {
  duracionPaso: 800,
  sombra: 45,
  tapaDura: true,
  permitirPantallaCompleta: true,
  permitirDescarga: true,
  efectoArrancar: false,
  sonidoPapel: false,
};

export const LIMITES_REVISTA = {
  duracionPaso: { min: 250, max: 2000, paso: 50 },
  sombra: { min: 0, max: 100, paso: 5 },
};

export const INTERRUPTORES_REVISTA = [
  { campo: 'tapaDura', etiqueta: 'Portada y contraportada rígidas', ayuda: 'Como un libro de tapa dura: la portada no se dobla al pasarla.' },
  { campo: 'permitirPantallaCompleta', etiqueta: 'Botón de pantalla completa' },
  { campo: 'permitirDescarga', etiqueta: 'Botón para abrir el PDF' },
  { campo: 'efectoArrancar', etiqueta: 'Efecto «arrancar la página» (3D)', ayuda: 'Botón que arranca la página visible con una animación 3D; la página vuelve a su sitio.' },
  { campo: 'sonidoPapel', etiqueta: 'Sonido de papel al arrancar' },
];

/** Ajustes de una revista con los valores por defecto para los que falten (datos simulados o antiguos). */
export const ajustesDe = (revista) => ({ ...AJUSTES_REVISTA, ...Object.fromEntries(Object.entries(revista || {}).filter(([, v]) => v !== undefined && v !== null)) });
