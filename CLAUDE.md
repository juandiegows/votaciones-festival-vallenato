# Sistema Web de Votaciones – Festival de la Leyenda Vallenata 2027

Proyecto académico (Areandina · Desarrollo Web 4324-61 · Prof. Deivys Morales Uribe).
Equipo: Juan Mejía Maestre (coordinación, UX/UI), Sebastián Bautista Martínez (análisis y modelado),
María Virginia Labarca Briceño (investigación y documentación).

## Reglas del proyecto
- Jerarquía de datos: **Edición → Categoría → Votación → Opción → Voto** (+ Usuario). La plataforma es
  configurable; nunca diseñar para una sola votación.
- **No inventar decisiones del cliente** (Fundación Festival de la Leyenda Vallenata): lo no confirmado se marca
  «Pendiente de validación» y se convierte en pregunta P-xx.
- IDs estables: RF-xx, RNF-xx, RN-xx, CU-xx, P-xx, R-xx. Mantener trazabilidad RF ↔ CU ↔ pantalla.
- Marca del cliente: `docs/BRANDING.md` (rojo #DD3333, negro, dorado #D7AC70; Raleway 800 + Poppins).
  Contraste WCAG 2.1 AA obligatorio. No usar el logo oficial ni fotos del Festival.
- Todo el texto de la interfaz y de la documentación va en **español de Colombia**, con tildes y ñ.
- Commits: mensajes en español, sin atribución a herramientas de IA (ver skill `commit-equipo`).

## Arquitectura
Desacoplada: `app/web` (React + Vite + Bootstrap 5, HashRouter) → `app/api` (Django REST Framework, desde la
Entrega 2) → MySQL. En la Entrega 1 la web usa datos simulados en `localStorage` (`app/web/src/data/`).

## Comandos
- Web: `cd app/web && npm run dev` · `npm run build`
- Docker local: `docker compose up -d --build` (http://localhost:8095) · `docker compose --profile dev up -d` (http://localhost:5195)
- Producción: https://votaciones.juandiegows.com (VPS, ver skill `desplegar`) · Demo: GitHub Pages.

## Agentes y skills
- Agentes (`.claude/agents/`): `analista-requerimientos`, `desarrollador-web`, `revisor-marca-ux`,
  `revisor-qa`, `arquitecto-api`.
- Skills (`.claude/skills/`): `trazabilidad`, `nueva-pantalla`, `commit-equipo`, `desplegar`, `informe-entrega`.
