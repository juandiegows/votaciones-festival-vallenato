---
name: nueva-pantalla
description: Agrega una pantalla nueva a app/web siguiendo la estructura, la marca y las reglas del proyecto (ruta, guardas, componentes, README y verificación). Úsala cuando se pida «crear la pantalla/vista/página de…».
---

# Agregar una pantalla a `app/web`

1. **Justificación**: identifica el RF y el CU que cubre la pantalla. Si no existen, detente y pide al agente `analista-requerimientos` que los redacte (o márcalos «Pendiente de validación»).
2. **Archivo**: `src/pages/NombrePantalla.jsx` (pública o de votante) o `src/pages/admin/AdminNombre.jsx` (administración). Usa `PageHeader` con título y una línea que cite el RF (p. ej. «Detalle de la votación (RF-06)»).
3. **Ruta** en `src/App.jsx`:
   - Pública: dentro de `<Route element={<Layout />}>`.
   - Requiere sesión: envuelve con `<RequiereSesion>`.
   - Administración: hija de `admin` (ya protegida por `<RequiereAdmin>`), y agrega el enlace al menú de `AdminLayout.jsx`.
4. **Datos**: lee y escribe solo a través de `useApp()` (`src/context/AppContext.jsx`). Si se necesita una acción nueva, agrégala allí, con nombre en español y pensada como futuro endpoint de la API.
5. **Marca y accesibilidad**: tokens `--flv-*` y clases de Bootstrap; Raleway en títulos; contraste AA; mobile-first; labels y mensajes de error accesibles.
6. **Documentación**: agrega la fila a la tabla de rutas de `app/web/README.md` (ruta, pantalla, RF/RN).
7. **Verificación**: `npm run build` sin errores y prueba manual o con el agente `revisor-qa`. Después pasa el agente `revisor-marca-ux`.
