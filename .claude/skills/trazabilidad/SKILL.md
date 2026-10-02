---
name: trazabilidad
description: Verifica y actualiza la matriz de trazabilidad RF ↔ CU ↔ RN ↔ pantalla del sistema de votaciones. Úsala cuando cambie un requerimiento, se agregue una pantalla o ruta, o antes de cerrar una entrega.
---

# Trazabilidad RF ↔ CU ↔ RN ↔ pantalla

1. **Inventario de requerimientos**: toma los RF, RN y CU vigentes del informe de la entrega actual (`docs/entrega-*/`).
2. **Inventario de pantallas**: lee las rutas de `app/web/src/App.jsx` y la tabla de rutas de `app/web/README.md`.
3. **Cruza** y construye la matriz:

   | RF | Caso de uso | Reglas | Pantalla / ruta | Estado |
   |---|---|---|---|---|

4. **Reporta huecos**:
   - RF sin caso de uso o sin pantalla.
   - Pantalla o ruta sin RF que la justifique.
   - RN que no se aplica en ninguna pantalla (busca el ID con `grep -rn "RN-0X" app/web/src`).
   - RF «Pendiente de validación» implementado como definitivo (debe mostrarse como configurable o ilustrativo).
5. **Corrige** solo lo documental (README de rutas, tablas del informe). Si falta código, propón la tarea para el agente `desarrollador-web`.
6. Cuando un cambio afecte al cliente, agrega o actualiza la pregunta P-xx correspondiente.
