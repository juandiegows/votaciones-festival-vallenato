# Reglas de Cloudflare (zona `juandiegows.com`)

`votaciones.juandiegows.com` pasa por Cloudflare (registro `votaciones` **proxied**) antes de llegar al nginx de la VPS.
Este documento resume la configuración vigente, leída de la API de Cloudflare el **17 de noviembre de 2026**, y lo que
implica para el desarrollo. Las expresiones exactas viven en el panel de Cloudflare (Security → WAF → Custom rules) y no
se copian aquí para no publicar la lista completa de bloqueos.

## Ajustes de la zona

| Ajuste | Valor | Efecto |
|---|---|---|
| SSL/TLS | **Full (strict)** | Cloudflare exige el certificado de origen válido (Origin Certificate `*.juandiegows.com`). |
| TLS mínimo · TLS 1.3 | 1.2 · activado | Navegadores antiguos sin TLS 1.2 no conectan. |
| Always Use HTTPS · Automatic HTTPS Rewrites | activado | Todo `http://` se redirige a `https://`. |
| HSTS | `max-age=15552000; includeSubDomains; preload` | El navegador recuerda usar solo HTTPS (6 meses). |
| 0-RTT | desactivado | Evita repeticiones de peticiones (replay) en el primer viaje. |
| Security Level · Browser Integrity Check | medio · activado | Desafío a IP de mala reputación y a clientes sin cabeceras de navegador. |
| Challenge TTL | 30 min | Tiempo que vale un desafío superado. |
| Hotlink Protection | activado | Otros sitios no pueden incrustar las imágenes (sí se ven al abrir el enlace directo). |
| Email Obfuscation · Server Side Exclude | activado | Oculta correos a los bots. |
| Brotli · HTTP/3 · IPv6 · WebSockets | activado | Rendimiento. |

Conjuntos administrados activos: **Cloudflare Managed Free Ruleset**, **DDoS L7**, normalización de URL y Managed
Response Firewall. No hay reglas de rate limiting en Cloudflare: los límites los aplican nginx (zonas `04-rate-limit-zones.conf`
de `vps-infra`) y DRF (`ScopedRateThrottle` en login, registro y voto).

## Reglas personalizadas del WAF (acción: bloquear)

| Regla | Qué bloquea (resumen) |
|---|---|
| **Maestra 1 – Rutas y plataformas sensibles** | Rutas típicas de escaneo: `.php`, WordPress (`wp-`, `xmlrpc`), `phpmyadmin`, **cualquier ruta que contenga `/admin`**, **`/vendor/`**, `/node_modules/`, `/backup`, `/debug/`, `/console`, `/keys/`, `/ssl/`, `..`, documentación de APIs (`/swagger`, `api-docs`, `openapi.json`, `openapi.yaml`), consolas de Java, Jenkins, Exchange, Kubernetes, etc. **Excepción:** `votaciones.juandiegows.com/api/docs` (Swagger del proyecto). |
| **Maestra 2 – Archivos y secretos sensibles** | `/.env` y cualquier ruta que empiece por `/.` (salvo `/.well-known/`), archivos de configuración y credenciales (`config.json`, `config.js`, `env.js`, `settings.json`, `credentials.json`, `docker-compose`, `Dockerfile`, `terraform`…) y extensiones de respaldo, código o llaves (`.sql`, `.bak`, `.log`, `.env`, `.yml`, `.ini`, `.pem`, `.key`, `.zip`, `.db`, `.py`…). |
| **Maestra 3 – Escáneres y cargas maliciosas** | User-Agent vacío o de herramientas de escaneo (`sqlmap`, `nikto`, `nmap`, `nuclei`, `wpscan`, `ffuf`…), cargas en la consulta (`union select`, `<script`, `${jndi`, `../`, `php://`, `169.254.169.254`…) y métodos HTTP raros (`TRACE`, `PROPFIND`, `DEBUG`…). |

Además, `autoban.py` (en `vps-infra`) bloquea a nivel de cuenta las IP con fuerza bruta o escaneo: 5 minutos, y 1 hora si reinciden.

## Qué implica para el proyecto

| Regla del WAF | Decisión en el código |
|---|---|
| Rutas con `/admin` | El panel vive en **`/panel/…`** y la API de gestión en **`/api/gestion/…`** (`/api/admin/…` queda solo como alias local). La web traduce `/admin/` → `/gestion/` en `api/cliente.js`. |
| Rutas con `/vendor/` | Las librerías estáticas del portal están en `portal/static/portal/libs/`, no en `vendor/`. |
| `openapi.yaml`, `/swagger`, `api-docs` | La documentación pública es `/api/docs/` (exceptuada). El esquema se versiona en `docs/api/openapi.yaml`, no se sirve por esa ruta. |
| Extensiones `.sql`, `.json`… en la ruta | Las exportaciones usan URL sin extensión (`/api/gestion/…/exportar/?formato=sql`, `/panel/exportar/votacion/{id}/sql`); el nombre del archivo llega en `Content-Disposition`. |
| `config.js`, `env.js` | Ningún archivo público usa esos nombres; Vite genera nombres con hash (`assets/index-XXXX.js`). |
| User-Agent vacío | Las pruebas con `curl` contra producción deben enviar un User-Agent (`curl -A "Mozilla/5.0" …`). |

Si una ruta nueva responde **403 con la página de Cloudflare** en producción y funciona en local, revisar primero estas
reglas antes de depurar Django o nginx.
