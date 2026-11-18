# Entrega 4 – Consolidación, pruebas integrales y presentación final

Registro de lo que se agregó o corrigió después de la Entrega 3. Cada fila apunta al código y a las pruebas que lo
respaldan. Producción: https://votaciones.juandiegows.com (desplegado el 17 de noviembre de 2026).

## Funcionalidades nuevas

### 1. Presentación de opciones «Imágenes con texto»

| | |
|---|---|
| Qué hace | Novena forma de mostrar las opciones de una votación: tarjeta con la imagen grande arriba y el nombre y la descripción debajo (dos por fila en el celular, tres en escritorio). Sin imagen, se usa el avatar con iniciales. |
| Dónde se elige | Formulario de la votación → «Cómo ve el público las opciones» (web `/panel/votaciones` y panel MVT). La vista previa en vivo la incluye. |
| Imagen de la opción | Campo nuevo `Opcion.foto` (migración `0009`): JPG, PNG o WebP de hasta 3 MB (2 MB en el modo demostración), validada con Pillow. Se sube, reemplaza o quita desde el formulario de la opción; el archivo anterior se borra del disco. |
| API | `foto` en `GET /api/opciones/`, en la votación por ruta y en `/api/gestion/opciones/` (multipart; `null` la quita). |
| SEO | Las imágenes de las opciones activas se publican en `sitemap.xml` (extensión `image:`). |
| Código | `votacion/models.py`, `serializers.py`, `portal/formularios.py`, `parciales/opciones_votacion.html`, `presentaciones/OpcionesVotacion.jsx`, `admin/FormularioOpcion.jsx` |
| Pruebas | `test_imagen_de_opcion_valida_formato_se_quita_y_se_borra`, `test_imagenes_con_texto_usa_la_imagen_subida_o_el_avatar` |

> **Pendiente de validación:** qué imágenes puede publicar la Fundación (derechos de imagen de artistas y
> participantes). El prototipo no incluye fotos del Festival; las que se suban son responsabilidad del administrador.
> Registrada como pregunta **P-18** (ver «Requerimientos nuevos» al final).

### 2. Exportar resultados de votaciones, categorías y ediciones (RF-14)

| | |
|---|---|
| Formatos | **PDF** (reporte con marca), **Excel** `.xlsx` (hoja «Resumen» y hoja «Resultados» con filtros), **CSV**, **JSON** (estructurado) y **SQL** (script para MySQL que crea `resultado_exportado` e inserta los conteos). |
| Qué exporta | Encabezado (edición, categoría, votación, número de votaciones, total de votos y fecha) y, por votación, posición · opción · votos · porcentaje con la líder resaltada. Solo conteos: **nunca** quién votó por cuál (voto secreto). |
| Dónde | Web: menú «Exportar» en cada fila de `/panel/ediciones` y `/panel/categorias`, en el resumen de `/panel/resultados` (edición) y en el detalle de cada votación. Panel MVT: menú «Exportar» en ediciones, categorías y `/panel/votos/{id}`. |
| API | `GET /api/gestion/{votaciones|categorias|ediciones}/{id}/exportar/?formato=pdf|excel|csv|json|sql` (solo administradores). Se conservan `…/votaciones/{id}/resultados/{csv,excel,pdf}/`. |
| Librerías | `openpyxl` (Excel) y `reportlab` (PDF). Código común en `votacion/exportacion.py`. |
| Modo demostración | Sin API, los cinco formatos se generan en el navegador (`utils/exportar.js`); el PDF abre un reporte imprimible («Guardar como PDF»). |
| Seguridad | CSV y Excel guardan los textos como texto (sin fórmulas), el SQL escapa comillas y cada descarga se audita (`exportar_resultados` con el formato). |
| Pruebas | `test_transferencia.ExportarResultadosTests` (15 combinaciones de entidad y formato, escape de SQL, permisos), `test_excel_no_ejecuta_formulas`, `test_plantilla_importar_y_exportar_desde_el_panel` |

### 3. Importar y exportar ediciones completas con una plantilla de Excel

| | |
|---|---|
| Plantilla | Libro con las hojas «Instrucciones», «Edición», «Categorías», «Votaciones» y «Opciones», listas desplegables (presentaciones, visibilidad, Sí/No, categorías) y una fila de ejemplo que se puede importar tal cual. |
| Importar | Se sube la plantilla llena: se valida **todo** antes de guardar (año único, nombres repetidos, fechas, cierre posterior a la apertura, categoría y votación existentes, valores de las listas, enlaces). Con un solo error no se crea nada y se muestra una tabla con hoja, fila y problema. |
| Qué se crea | La edición queda **cerrada** (no visible) salvo que se marque «Activarla al importar» (cierra la activa). Las votaciones quedan en **borrador**. Las URL amigables vacías se generan solas. Imágenes, íconos y audios se suben después. |
| Exportar edición | «Exportar → Plantilla de Excel con los datos» descarga la edición en la misma plantilla: sirve de respaldo y para copiarla a otro año (cambiar nombre y año, y volver a importarla). |
| Dónde | Web: `/panel/ediciones` → «Importar desde Excel» (requiere la API; en el modo demostración se explica que lo procesa el servidor). Panel MVT: `/panel/ediciones` → «Plantilla de Excel» e «Importar edición» (`/panel/ediciones/importar`). |
| API | `GET /api/gestion/ediciones/plantilla/` · `POST /api/gestion/ediciones/importar/` (multipart: `archivo`, `activar`) · `GET /api/gestion/ediciones/{id}/exportar-estructura/`. |
| Límites | `.xlsx` verificado por su firma, máximo 5 MB y 3000 filas por hoja; se audita `importar_edicion` y `exportar_edicion`. |
| Código y pruebas | `votacion/transferencia.py`, `portal/vistas/panel/transferencia.py`, `admin/ImportarEdicion.jsx`, `admin/MenuExportar.jsx` · `test_transferencia.ImportarEdicionTests` (ejemplo, activar, errores sin crear nada, fechas y listas, archivo inválido, exportar y reimportar). |

### 4. URL amigable sugerida automáticamente

Al escribir el nombre de una categoría o el título de una votación, el campo «Identificador en la URL» se completa
solo (`Canción inédita` → `cancion-inedita`), sin repetirse dentro de su edición o categoría (agrega `-2`, `-3`…).
Si la persona escribe su propio identificador, la sugerencia se detiene; al editar un elemento que ya tiene URL no se
cambia, para no romper enlaces publicados. Web: `slugSugerido` en `utils/helpers.js`; panel MVT: `portal.js` con la
etiqueta `slugs_usados`. Prueba: `test_formulario_sugiere_la_url_amigable_sin_repetir`.

### 5. Textos del proyecto y datos de demostración configurables

| | |
|---|---|
| Textos del proyecto | El aviso «Prototipo académico…» del pie, el subtítulo del logo y el texto «Acerca de» se editan (o se ocultan dejándolos vacíos) en Configuración → Sitio; la página del equipo se puede ocultar (responde 404). Migración `0010`. |
| Cuentas de demostración | Configuración → Demostración: «Permitir el ingreso con las cuentas de demostración». Apagado, `admin@festival.test`, `votante@festival.test` y `@demo.festival.test` no inician sesión (backend `AutenticacionConCuentasDemo`, también cierra sus sesiones abiertas) y el login no muestra credenciales. Migración `0011`. |
| Datos de demostración | Botones «Eliminar datos de demostración» (escribir ELIMINAR) y «Volver a cargar» (escribir CARGAR): borran o recrean lo que crea `cargar_demo`, conservando contacto, redes, marca y configuración. API: `GET /api/gestion/demo/`, `POST /api/gestion/demo/{eliminar,cargar}/`. |
| Protección | Apagar las cuentas demo, eliminar o recargar exige una cuenta de administrador **propia** (no de demostración) y que exista al menos una activa: así nadie queda fuera del panel. |
| Plantilla de Excel | Ícono y votación (hoja «Opciones») se eligen de listas desplegables. |
| Pruebas | `test_demo.py` (5), `TextosDelProyectoTest` (2), `test_icono_y_votacion_se_eligen_de_listas`. |

### 6. Registros técnicos (logs) con interceptor (RF-19, RNF-12)

| | |
|---|---|
| Qué hace | Cuando algo falla en el código queda registrado **qué** falló (excepción y traza), **dónde** (archivo, línea y función de nuestro código), **en qué petición** (método, ruta, estado) y **a quién** le pasó (usuario, IP, navegador). Distinto de la auditoría (RF-16), que guarda lo que hace la administración. |
| Interceptor | `votaciones/registros/interceptor.py` (middleware): da a cada petición una **referencia** (`X-Request-ID`), escribe la línea de acceso y atrapa toda excepción no controlada. Responde 500 con la referencia: JSON `{"detail", "codigo": "error_interno", "referencia"}` en `/api/…` y página de error con la marca en el sitio. Los 400/403/404 no se registran (no son fallos del código). |
| Web React | El cliente HTTP muestra «Ocurrió un error inesperado. Referencia: …» en los 5xx. Los errores de JavaScript (`window.onerror`, promesas rechazadas y el `ErrorBoundary`) se envían a `POST /api/registros/web/` (máximo 10 por carga, sin repetir el mismo en un minuto, 20/min por IP en el servidor). |
| Dónde se ven | `/panel/registros` (web y panel MVT): resumen de 24 h y 7 días, filtros (nivel, servidor o web, periodo, búsqueda por referencia), traza desplegable, descarga TXT/JSON y botón «Provocar un error de prueba». API: `GET /api/gestion/registros/`, `…/resumen/`, `POST …/probar/`. Permiso `registros.ver` (solo administrador por defecto). |
| Consola y archivos | `LOGGING` en `settings.py`: consola en JSON (`docker logs`) con referencia, usuario e IP en cada línea; con `LOG_DIR`, `app.log` y `errores.log` que rotan cada medianoche. Variables `LOG_*` en `app/api/README.md`. |
| Datos | Tabla `registro_sistema` (migración `0017`); se borran los de más de `LOG_DIAS_RETENCION` días (30). No guarda contraseñas ni el cuerpo de las peticiones. |
| Pruebas | `votaciones/tests/test_registros.py` (11) y `portal/tests/test_registros_panel.py` (4). |

> **Pendiente de validación (P-19):** días de conservación, quién más puede ver los registros y si se debe avisar
> por correo cuando ocurre un error. Los valores actuales (30 días, solo administrador, sin aviso) son decisiones
> técnicas del equipo.

### 7. Verificación en dos pasos (2FA) (RF-20, RNF-13)

| | |
|---|---|
| Qué hace | Agrega un segundo paso al inicio de sesión: después del correo y la contraseña correctos, la cuenta que tenga la verificación activa debe escribir un código antes de que se abra la sesión (sitio MVT) o se entregue el token (API). Es **opcional** y la activa cada persona en su cuenta, sea cual sea su rol. |
| Dónde se activa | «Mi cuenta → Seguridad»: `/cuenta/seguridad` en el sitio MVT y en la web React. |
| Métodos | Uno a la vez. **App autenticadora** (TOTP, RFC 6238: SHA-1, 6 dígitos, periodo de 30 s, tolerancia de ±1 periodo y sin aceptar dos veces el mismo código), compatible con Google Authenticator, Microsoft Authenticator, Authy y similares; se activa escaneando el código QR (o escribiendo la clave) y confirmando un código. **Código por correo**: 6 dígitos enviados al correo verificado; vence en 10 minutos, admite máximo 5 intentos y se puede reenviar cada 60 s. |
| Códigos de respaldo | Al activar se entregan 10 códigos de un solo uso; se muestran una sola vez y se guardan con hash. Se pueden regenerar escribiendo la contraseña (los anteriores dejan de servir). |
| Inicio de sesión | El desafío del paso 2 vence en 5 minutos; después hay que volver a escribir correo y contraseña. El paso 2 acepta el código del método activo o un código de respaldo. |
| Desactivar | Exige la contraseña actual. |
| Auditoría y avisos | Activar, desactivar y regenerar los códigos de respaldo queda en la auditoría (RF-16) y se avisa por correo al titular de la cuenta. |
| API | `GET /api/auth/2fa/` (estado) · `POST /api/auth/2fa/totp/iniciar/`, `…/totp/activar/`, `…/correo/iniciar/`, `…/correo/activar/`, `…/desactivar/`, `…/codigos-respaldo/`, `…/verificar/` y `…/reenviar/`. `POST /api/auth/login/` responde `{"requiere_2fa": true, "metodo", "desafio"}` cuando la cuenta tiene la verificación activa. |
| Modo demostración | Sin API (GitHub Pages) la verificación en dos pasos no está disponible: la pantalla de seguridad muestra un aviso. |
| Código y pruebas | Modelo `SegundoFactor` (`votaciones/cuentas/models.py`, migración `0018`), reglas en `votaciones/cuentas/servicios_2fa.py` (TOTP propio según RFC 6238, QR con `segno`), API en `votaciones/cuentas/views.py`, portal en `portal/vistas/seguridad.py` (`/verificar-acceso`, `/cuenta/seguridad`), web en `app/web/src/pages/Seguridad.jsx` y el paso 2 de `Login.jsx`; correos `codigo_verificacion` y `aviso_seguridad`. Pruebas: `votaciones/tests/test_dos_pasos.py` (vectores del RFC 6238 incluidos) y `portal/tests/test_dos_pasos.py`. |

> **Decisión del equipo (P-20, P-21, 18 de noviembre de 2026):** la verificación en dos pasos es **opcional** para
> todos los roles. Cada persona, votante o administrador, la activa desde su propio perfil (Mi cuenta → Seguridad).
> Se ofrecen dos métodos: **código por correo** y **app autenticadora** (Google Authenticator, Microsoft Authenticator…).
> No se ofrece SMS. Si alguien pierde el acceso y sus códigos de respaldo (R-11), quien tenga el permiso
> `usuarios.quitar_2fa` (Usuarios en el panel) puede quitarle la verificación **escribiendo un motivo** (mínimo
> 20 caracteres): el motivo queda en la auditoría y se le envía por correo a la persona. Nadie la quita de su propia
> cuenta por esa vía ni de una cuenta cuyo rol tenga permisos que él no tiene.

## Correcciones

| Problema | Solución |
|---|---|
| En el celular el texto del banner del inicio se salía por arriba y el título quedaba cortado. | Imagen y texto comparten la misma celda (CSS grid): si el texto no cabe, el banner crece. Tipografía y márgenes ajustados por debajo de 576 px. |

## SEO y endurecimiento

| Cambio | Archivo |
|---|---|
| Canonical, Open Graph, Twitter Card y enlace al mapa del sitio en todas las páginas del sitio MVT (en producción la raíz la atiende Django). | `portal/templates/portal/base.html`, etiquetas `url_canonica` y `url_sitio` |
| `/sitemap.xml` redirige (301) a `/api/sitemap.xml`. | `config/urls.py`, `nginx.conf`, `.htaccess` |
| `robots.txt` y `X-Robots-Tag: noindex` cubren también recuperar/restablecer clave y completar documento. | `public/robots.txt`, `nginx.conf`, `.htaccess` |
| Respaldos, volcados y archivos de configuración (`.sql`, `.bak`, `.env`, `.log`, `.map`…) responden 404. | `nginx.conf`, `.htaccess` |
| `color-scheme` y enlace al mapa del sitio en la SPA. | `app/web/index.html` |
| Reglas del WAF de Cloudflare documentadas con su impacto en el código. | [`docs/seguridad/cloudflare.md`](../seguridad/cloudflare.md) |

## Cómo verificar

```bash
cd app/api && python manage.py test                      # 477 pruebas (votaciones y portal)
cd app/web && npm run build
curl -I https://votaciones.juandiegows.com/sitemap.xml    # 301 → /api/sitemap.xml
```

## Requerimientos nuevos y trazabilidad

Se agregan a los del informe de la Entrega 1 (RF-01…RF-18, RNF-01…RNF-11, CU-01…CU-13, P-01…P-17, R-01…R-09).

| ID | Tipo | Descripción | Estado |
|---|---|---|---|
| RF-19 | Funcional | El sistema deberá permitir al administrador consultar, filtrar y descargar los registros técnicos (errores del servidor y de la web) y buscar un error por su referencia. Actor: Administrador. Prioridad: Media. | Preliminar |
| RNF-12 | Observabilidad | Los errores no controlados del servidor y de la web quedarán registrados con fecha y hora, traza, archivo y línea, petición, usuario e IP; cada error tendrá una referencia que se muestra al usuario para reportarlo. | Preliminar |
| CU-14 | Caso de uso | **Consultar registros del sistema.** Actor: Administrador. Precondición: sesión con el permiso `registros.ver`. Flujo: 1) entra a `/panel/registros`; 2) filtra por nivel, origen (servidor o web) y periodo, o escribe la referencia que reportó un usuario; 3) abre el registro y revisa la traza y dónde falló; 4) opcional: descarga TXT o JSON. Alterno: sin el permiso, página 403 y la sección no aparece en el menú. | — |
| P-18 | Pregunta | Imágenes de las opciones: ¿qué imágenes puede publicar la Fundación (derechos de imagen de artistas y participantes)? | Pendiente |
| P-19 | Pregunta | Registros técnicos: ¿cuántos días se conservan? ¿quién además del administrador puede verlos? ¿se debe avisar por correo cuando ocurre un error? | Pendiente |
| R-10 | Riesgo | Los registros técnicos guardan datos personales (correo, IP, navegador) y podrían exponerse (Ley 1581, RNF-08). Probabilidad: Baja. Impacto: Medio. Mitigación: acceso solo con `registros.ver`, borrado automático por antigüedad, sin contraseñas ni cuerpo de las peticiones. | — |
| RF-20 | Funcional | El sistema deberá permitir a cualquier usuario registrado activar en su cuenta la verificación en dos pasos (app autenticadora TOTP o código por correo, uno a la vez), recibir 10 códigos de respaldo, regenerarlos y desactivar la verificación con su contraseña, y deberá pedir el código del segundo paso al iniciar sesión cuando la cuenta la tenga activa. Actor: Votante, Administrador (cualquier rol), desde su propio perfil; opcional, nunca obligatoria. Prioridad: Media. | Validado (P-20, P-21) |
| RNF-13 | Seguridad | El segundo paso cumplirá RFC 6238 (SHA-1, 6 dígitos, 30 s, tolerancia ±1 periodo, sin reutilizar un código); el código por correo vencerá en 10 minutos con máximo 5 intentos y reenvío cada 60 s; el desafío del inicio de sesión vencerá en 5 minutos; los códigos de respaldo se guardarán con hash y serán de un solo uso; activar, desactivar y regenerar quedarán auditados y se avisarán por correo. Complementa RNF-01. | Validado (P-20, P-21) |
| CU-15 | Caso de uso | **Gestionar la verificación en dos pasos.** Objetivo: proteger la cuenta con un segundo factor. Actor: usuario registrado (cualquier rol). Precondiciones: sesión iniciada; para el método por correo, correo verificado; sistema con API (no modo demostración). Flujo: 1) entra a «Mi cuenta → Seguridad» (`/cuenta/seguridad`); 2) elige el método (app autenticadora o correo); 3) el sistema muestra el QR y la clave, o envía el código al correo; 4) escribe el código; 5) el sistema lo valida, activa la verificación y muestra los 10 códigos de respaldo una sola vez; 6) el sistema registra la acción en la auditoría y avisa por correo. Alternos: 3a) modo demostración: se muestra el aviso de que no está disponible y termina; 3b) método por correo con el correo sin verificar: no se puede activar hasta verificarlo; 4a) pide otro código por correo: se reenvía si pasaron 60 s; 5a) código incorrecto o vencido: mensaje de error y vuelve al paso 4 (por correo, máximo 5 intentos y 10 minutos); 7a) regenerar los códigos de respaldo: escribe la contraseña, se invalidan los anteriores y se muestran los nuevos; 7b) desactivar: escribe la contraseña actual, se desactiva, se audita y se avisa por correo; 7c) contraseña incorrecta en 7a o 7b: no se hace el cambio. Extiende CU-02: tras correo y contraseña correctos, si la cuenta tiene la verificación activa, se pide el código del método o uno de respaldo antes de abrir la sesión o entregar el token; si el desafío vence (5 minutos) se vuelve a pedir la contraseña. Postcondiciones: la verificación queda activa o inactiva según la acción, con su rastro en la auditoría. Relacionados: RF-02, RF-16, RF-20, RNF-01, RNF-13. | — |
| P-20 | Pregunta | Verificación en dos pasos: ¿debe ser obligatoria para los roles con acceso al panel de administración, o se mantiene opcional para todos? | Pendiente |
| P-21 | Pregunta | Verificación en dos pasos: ¿qué método prefiere la Fundación por defecto (app autenticadora o código por correo)? ¿se debe ofrecer también el código por SMS? | Respondida: correo y app autenticadora, a elección de cada persona; sin SMS |
| R-11 | Riesgo | Una persona pierde el celular o la app autenticadora y no tiene sus códigos de respaldo: la cuenta queda sin acceso. Probabilidad: Media. Impacto: Alto (más si es una cuenta de administración). Mitigación: 10 códigos de respaldo de un solo uso y regenerables (implementado); la administración puede quitar la verificación de otra cuenta con un motivo obligatorio que queda en la auditoría y se le envía a la persona (implementado, permiso `usuarios.quitar_2fa`). | Mitigado |

Matriz actualizada (solo lo que cambió):

| RF | Caso de uso | Reglas / RNF | Pantalla / ruta | Estado |
|---|---|---|---|---|
| RF-17 | — (complementario) | — | `/panel/usuarios`, `/panel/roles` | Pendiente de validación |
| RF-19 | CU-14 | RNF-08, RNF-12 | `/panel/registros` | Preliminar (P-19) |
| RF-02 | CU-02 (extendido por CU-15) | RNF-01, RNF-13 | `/login` (paso 2 del código) | Sin cambio de estado; se agrega el paso 2 |
| RF-20 | CU-15 | RNF-01, RNF-13, RF-16 (auditoría) | `/cuenta/seguridad` (web y sitio MVT), `/login` (paso 2) | Validado (P-20, P-21) |

## Pendiente para cerrar la entrega

- Sustentación en vivo (la actividad del Eje 4 no pide informe PDF ni video): guía en [`sustentacion.md`](sustentacion.md).
