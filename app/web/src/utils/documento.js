// Documento de identidad del votante: una persona = una cuenta. Mismas reglas que la API (votaciones/cuentas.py).
export const TIPOS_DOCUMENTO = [
  { valor: 'CC', etiqueta: 'Cédula de ciudadanía' },
  { valor: 'CE', etiqueta: 'Cédula de extranjería' },
  { valor: 'TI', etiqueta: 'Tarjeta de identidad' },
  { valor: 'PA', etiqueta: 'Pasaporte' },
  { valor: 'PPT', etiqueta: 'Permiso por protección temporal (PPT)' },
];

const FORMATOS = {
  CC: [/^\d{5,10}$/, 'La cédula de ciudadanía tiene entre 5 y 10 dígitos.'],
  TI: [/^\d{8,11}$/, 'La tarjeta de identidad tiene entre 8 y 11 dígitos.'],
  CE: [/^[A-Z0-9]{4,12}$/, 'La cédula de extranjería tiene entre 4 y 12 letras o números.'],
  PA: [/^[A-Z0-9]{5,15}$/, 'El pasaporte tiene entre 5 y 15 letras o números.'],
  PPT: [/^[A-Z0-9]{5,15}$/, 'El PPT tiene entre 5 y 15 letras o números.'],
};

/** «1.065.123.456» → «1065123456» (sin puntos, guiones ni espacios; en mayúsculas). */
export function normalizarDocumento(numero = '') {
  return numero.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

/** Mensaje de error del número según el tipo, o null si es válido. */
export function errorDocumento(tipo, numero) {
  if (!tipo) return 'Elige el tipo de documento.';
  const limpio = normalizarDocumento(numero);
  if (!limpio) return 'Ingresa el número de documento.';
  const [patron, mensaje] = FORMATOS[tipo] || [];
  return patron && !patron.test(limpio) ? mensaje : null;
}
