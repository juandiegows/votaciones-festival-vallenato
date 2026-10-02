# Sistema Web de Votaciones – Festival de la Leyenda Vallenata 2027

Proyecto de la asignatura **Desarrollo Web (4324 – 61)** · Fundación Universitaria del Área Andina · 2026.
Profesor: Deivys Morales Uribe.

Plataforma web configurable para gestionar votaciones del público del Festival de la Leyenda Vallenata,
organizada bajo la jerarquía **Edición → Categoría → Votación → Opción → Voto**.

> Proyecto académico. No es la plataforma oficial del Festival; los datos del prototipo son ficticios.

## Equipo

| Integrante | Rol |
|---|---|
| Juan Mejía Maestre | Coordinación y diseño UX/UI |
| Sebastián Bautista Martínez | Análisis y modelado |
| María Labarca Briceño | Investigación y documentación |

## Estructura del monorepositorio

```
votaciones-festival-vallenato/
├── docs/                 Documentación del proyecto
│   ├── BRANDING.md       Identidad visual (paleta, tipografías, reglas de uso)
│   └── entrega-1/        Informe PDF, diagramas y capturas del prototipo
├── prototipo/            Prototipo navegable (React + Vite + Bootstrap, sin backend)
├── app/                  Aplicación Django + MySQL (entregas 2 a 4, próximamente)
└── .github/workflows/    Despliegue del prototipo en GitHub Pages
```

## Entregas

| Entrega | Contenido | Estado |
|---|---|---|
| 1 | Análisis, requerimientos, casos de uso, modelo conceptual y prototipo navegable | ✅ [Informe PDF](docs/entrega-1/Eje1_Entrega1_Votaciones_Festival_Vallenato.pdf) |
| 2 – 4 | Desarrollo con Django (MVT) y MySQL | Pendiente |

## Prototipo

- **Demo en línea:** https://juandiegows.github.io/votaciones-festival-vallenato/
- Instrucciones, rutas y credenciales de prueba: [`prototipo/README.md`](prototipo/README.md)

```bash
cd prototipo
npm install
npm run dev
```

## Arquitectura de referencia

| Componente | Tecnología |
|---|---|
| Backend | Python + Django (patrón MVT) |
| Base de datos | MySQL |
| Frontend | HTML5, CSS3, Bootstrap, JavaScript |
| Integración | Aplicación independiente enlazada desde el sitio del Festival (subdominio pendiente de validación) |
