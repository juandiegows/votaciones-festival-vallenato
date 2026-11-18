# Política de seguridad

Sistema Web de Votaciones – Festival de la Leyenda Vallenata (proyecto académico, Areandina).
Producción: https://votaciones.juandiegows.com · Contacto legible por máquinas: [`/.well-known/security.txt`](https://votaciones.juandiegows.com/.well-known/security.txt) (RFC 9116).

## Cómo reportar una vulnerabilidad

Repórtala **de forma privada** en
[GitHub Security Advisories](https://github.com/juandiegows/votaciones-festival-vallenato/security/advisories/new).
No abras un issue público ni publiques detalles hasta que el problema esté corregido.

Incluye, si puedes:

- URL o endpoint afectado y pasos para reproducirlo.
- Impacto esperado (p. ej. votar más de una vez, ver datos de otro votante, acceder al panel).
- Navegador, sistema y fecha de la prueba.

Respondemos en un plazo de 7 días hábiles e informamos cuando se publique la corrección.

## Alcance

- Web: https://votaciones.juandiegows.com y la demostración en GitHub Pages.
- API: https://votaciones.juandiegows.com/api/

Fuera de alcance: denegación de servicio, pruebas de carga, ingeniería social, spam y hallazgos de escáneres
automáticos sin una prueba de concepto.

## Versiones con soporte

Solo la rama `main` desplegada en producción recibe correcciones. Las dependencias se revisan con las alertas de seguridad de GitHub y las
imágenes Docker se reconstruyen con los parches del sistema operativo.

## Controles implementados

| Área | Control |
| --- | --- |
| Voto | Un voto por usuario, categoría y edición: validado en Django y garantizado por una restricción única en MySQL (resiste solicitudes simultáneas). Formularios con CSRF. |
| Voto secreto | Los reportes (Excel, PDF, CSV) y la lista de participantes nunca cruzan votante y opción; la lista de participantes se oculta con pocos votantes. |
| Cuentas | Contraseñas con hash de Django, confirmación de correo, recuperación con token de un solo uso; el panel exige rol de administrador. |
| Archivos subidos | Imágenes verificadas con Pillow (JPG, PNG o WebP, tamaño máximo), audio por extensión y tipo, PDF por su firma `%PDF-`. Los archivos reemplazados o eliminados se borran del disco. |
| Exportaciones | Las celdas de CSV y Excel que empiezan por `=`, `+`, `-` o `@` se guardan como texto (sin inyección de fórmulas). Cada descarga queda en la auditoría. |
| Auditoría | Toda creación, edición, eliminación, publicación y exportación se registra con usuario, fecha e IP. |
| Navegador | CSP estricta, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` y COOP (`nginx-seguridad.conf` y `.htaccess`). |
| Servidor | Archivos ocultos, respaldos y volcados (`.env`, `.git`, `.sql`, `.bak`…) responden 404; páginas privadas con `X-Robots-Tag: noindex`. El panel vive en `/panel` y la API de gestión en `/api/gestion` (el WAF bloquea `/admin`). |
| Secretos | Fuera del repositorio: variables de entorno del servidor y `.env` locales ignorados por git. |

## Reglas para la investigación

- Usa solo cuentas propias o de prueba; no accedas, modifiques ni borres datos de otras personas.
- No alteres los resultados de votaciones reales.
- Detén la prueba y repórtanos en cuanto obtengas acceso a datos personales.

Agradecemos los reportes responsables y daremos crédito a quien lo desee.
