// Credenciales de las cuentas de demostración (las mismas que crea `python manage.py cargar_demo` en la API).
// Datos ficticios: «Solo lectura» y «Lectura y escritura» muestran el panel con roles delegados.
export const CREDENCIALES_DEMO = [
  { rol: 'Votante', correo: 'votante@festival.test', contrasena: 'Voto2027*' },
  { rol: 'Administrador', correo: 'admin@festival.test', contrasena: 'Admin2027*' },
  { rol: 'Solo lectura', correo: 'lectura@demo.festival.test', contrasena: 'Admin2027*' },
  { rol: 'Lectura y escritura', correo: 'editor@demo.festival.test', contrasena: 'Admin2027*' },
];
