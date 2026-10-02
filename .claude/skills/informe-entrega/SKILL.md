---
name: informe-entrega
description: Prepara y revisa el informe PDF de cada entrega del curso (estructura mínima, normas APA, coherencia con la web y checklist de la actividad). Úsala al iniciar o cerrar una entrega en docs/entrega-N/.
---

# Informe de entrega

## Estructura mínima (Entrega 1, base para las siguientes)
Portada · Tabla de contenido · Integrantes · Contexto · Benchmarking · Problema · Objetivos · Alcance · Actores · RF · RNF · Reglas de negocio · Preguntas al cliente · Casos de uso · Modelo conceptual · Prototipo (enlace) · Flujo principal · Riesgos · Arquitectura · Conclusiones · Fuentes.

## Formato
- Plantilla institucional de Areandina (APA 7): Times New Roman 12, títulos con estilos de la plantilla y tabla de contenido actualizada.
- Tablas con «Tabla N» en negrita y el título en cursiva encima; figuras con «Figura N» y una nota «Elaboración propia» debajo.
- Citas en el texto (Autor, año) y lista de fuentes en APA con sangría francesa; toda fuente citada debe estar en la lista y viceversa.
- Brevedad: el contexto se limita a lo esencial (el equipo prefiere secciones cortas).

## Coherencia (antes de exportar)
1. Ejecuta la skill `trazabilidad`.
2. Los enlaces a la web (GitHub Pages y votaciones.juandiegows.com) responden 200.
3. Las capturas corresponden a la versión publicada (regenéralas con el agente `revisor-qa` si cambió la interfaz).
4. Lo no confirmado por el cliente aparece como «Pendiente de validación».
5. La arquitectura descrita coincide con la del repositorio (desacoplada: React + Django REST + MySQL).

## Publicación
Guarda el PDF final en `docs/entrega-N/` junto con `diagramas/` y `capturas/`, actualiza `docs/entrega-N/README.md` y la tabla de entregas del `README.md` raíz, y haz commit con la skill `commit-equipo`.

## Checklist del docente
PDF completo · integrantes identificados · mínimos cumplidos (≥3 benchmarking, ≥6 RF, ≥6 RNF, ≥6 RN, ≥10 preguntas, ≥6 CU, ≥6 riesgos) · diagramas · enlace funcionando · conclusiones · fuentes · ortografía revisada · todos los integrantes comprenden la propuesta.
