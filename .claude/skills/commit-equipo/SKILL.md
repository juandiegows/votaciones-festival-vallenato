---
name: commit-equipo
description: Cómo hacer commit y push con la identidad correcta de cada integrante del equipo (Juan, Sebastián o María) y con el formato de mensajes del proyecto. Úsala cada vez que se pida «guardar», «hacer commit» o «subir» cambios a nombre de alguien.
---

# Commits del equipo

## Identidades
| Integrante | Comando | GitHub |
|---|---|---|
| Juan Mejía Maestre | `git commit` / `git push` (identidad global) | @juandiegows |
| Sebastián Bautista Martínez | `git como-sebastian commit …` / `git como-sebastian push` | @sbautista15 |
| María Virginia Labarca Briceño | `git como-maria commit …` / `git como-maria push` | @mlabarca-jpg |

`como-sebastian` y `como-maria` son alias globales de git en el equipo de Juan: fijan nombre, correo institucional y la llave SSH de cada uno (`~/.ssh/id_ed25519_github_{sebastian,maria}`). Si el alias no existe en otro equipo, cada integrante usa su propia configuración de git.

## Reglas
1. Mensaje en español, en imperativo y breve (≤ 72 caracteres en la primera línea), p. ej. «Agregar pantalla de resultados públicos».
2. **Sin atribución a herramientas de IA**: no agregar líneas `Co-Authored-By` de asistentes ni menciones a IA en el mensaje.
3. Un commit por cambio lógico; no mezclar documentación con código si no están relacionados.
4. Antes de commitear: `git pull`, `npm run build` si se tocó `app/web`, y revisar `git status` (no subir `node_modules`, `dist`, `.env`).
5. Después del push, verifica la atribución:
   `gh api repos/juandiegows/votaciones-festival-vallenato/commits/main -q '.author.login'`
6. Si el push falla con «Permission denied» o «Repository not found», el integrante no ha aceptado la invitación de colaborador o su llave no está en su cuenta de GitHub.
