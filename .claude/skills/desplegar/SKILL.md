---
name: desplegar
description: Publica la web del sistema de votaciones en GitHub Pages y en la VPS (votaciones.juandiegows.com) y verifica que quedó en línea. Úsala cuando se pida desplegar, publicar o actualizar producción.
---

# Despliegue

## 1. Construcción automática (GitHub Actions)
Cada push a `main` que toque `app/web/**` dispara:
- `Desplegar web en GitHub Pages` → https://juandiegows.github.io/votaciones-festival-vallenato/
- `Imagen Docker de la web (VPS)` → `ghcr.io/juandiegows/votaciones-festival-vallenato-web:latest` y `:<sha>`

Espera a que terminen: `gh run list --limit 3` (ambos en `success`).

## 2. VPS (votaciones.juandiegows.com)
Infraestructura en el repositorio `vps-infra` (`docker/votaciones-flv/`, vhost `docker/edge/conf.d/votaciones-flv.conf`, puerto `127.0.0.1:5178`).

```bash
ssh vps-contabo
cd /opt/vps-infra/docker/votaciones-flv
docker compose -p votaciones-prod -f docker-compose.prod.yml pull
docker compose -p votaciones-prod -f docker-compose.prod.yml up -d
docker inspect -f '{{.State.Health.Status}}' votaciones_web   # healthy
```

- Fijar una versión: `VOTACIONES_WEB_VERSION=<sha> docker compose … up -d`.
- Si cambió el vhost: `docker exec edge_nginx nginx -t` y, solo si pasa, `docker exec edge_nginx nginx -s reload`.
- **Precaución**: `/opt/vps-infra` puede tener trabajo sin commitear de otros proyectos. No hacer `git stash`, `reset` ni `pull` forzado sin revisar `git status` y confirmarlo con Juan.

## 3. Verificación
- `curl -s -o /dev/null -w "%{http_code}" https://votaciones.juandiegows.com/` → 200
- Recorrido rápido con el agente `revisor-qa` sobre la URL pública.
- El registro DNS `votaciones` debe estar en Cloudflare como **proxied**; sin proxy, nginx responde 403 o rechaza el TLS.
