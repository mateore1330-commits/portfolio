# Cómo se despliega la API

> Montado en INFRA-06. La web (`apps/web`) la despliega Vercel (GO-02); esto es la API y el servidor.

## En una frase

**Lo que se fusiona en `main` es lo que está publicado.** Al fusionar un PR en `main` (y solo si cambió algo
de la API o del servidor), GitHub construye la imagen, la sube a ghcr.io y avisa al servidor, que la pone en
marcha con red de seguridad.

```
PR develop → main  ──►  GitHub Actions (.github/workflows/deploy-api.yml)
                          1. docker build → ghcr.io/mateore1330-commits/portfolio-api:<commit>
                          2. ssh despliegue@servidor <commit>
                                    │
                                    ▼
                        portfolio-desplegar (en el servidor, como root)
                          a. código de main hasta ese commit (compose, Caddyfile)
                          b. baja la imagen
                          c. copia de la base (INFRA-05)  ── si falla, no se despliega
                          d. migraciones con la imagen nueva ── si fallan, no se toca la API
                          e. la API nueva (y Caddy relee su configuración si cambió)
                          f. ¿/api/health responde y es la nueva? ── si no, VUELVE SOLA a la anterior
```

Si algo falla, el flujo sale en rojo y **GitHub manda un correo**. Lo que dijo el servidor está en el registro
del trabajo "Desplegar en el servidor" y en `ssh -t portfolio 'sudo journalctl -t portfolio-desplegar'`.

## Cuándo se lanza (y cuándo no)

- Al llegar a `main` un cambio en `apps/api/`, en lo que va dentro de la imagen (`scripts/comprobar-idiomas.py`,
  el retrato de `apps/web/src/recursos/retrato/`, `.dockerignore`) o en lo que usa el servidor
  (`infra/docker-compose.yml`, `infra/Caddyfile`, `infra/db/`).
- **No** si solo cambia `apps/web` u otra cosa (documentación…).
- A mano: GitHub → Actions → **Desplegar API** → *Run workflow* (rama `main`). Despliega el último commit de
  `main`.
- Nunca dos a la vez (el segundo espera).

## Pasar de `develop` a `main`

Un PR de `develop` a `main` con **merge normal** ("Create a merge commit"; `main` no exige historial lineal).
`main` está protegida: solo por PR, con el check `CI` en verde, sin `push` directo ni borrado.

## La seguridad del despliegue

- **Una llave solo para esto**, distinta de la de Mateo. Vive **solo** en los secretos de GitHub (entorno
  `produccion`: `DESPLIEGUE_LLAVE`, `DESPLIEGUE_HOST` y `DESPLIEGUE_HUELLA`, la huella del servidor, para no
  hablar con un impostor). Se crea en el servidor con `infra/servidor/5-despliegue.sh` y se enseña una sola vez.
- Entra con el usuario **`despliegue`**: sin contraseña, sin terminal, sin túneles ni copia de archivos, con su
  casa y su llave de root (no puede cambiarlas). **Orden forzada** (en la llave y en sshd): diga lo que diga,
  solo se ejecuta `sudo portfolio-desplegar "<lo que pidió>"`, y ese programa solo acepta un commit (40
  caracteres hexadecimales) **que esté en `main`**. `sudo` solo le deja ese programa.
- Con la llave robada, como mucho se podría volver a desplegar una versión que ya está en `main`.
- La imagen es **pública** (como el repositorio) y **no lleva secretos**: llegan del `api.env` del servidor.

## La regla de las migraciones

Si una versión nueva falla y vuelve la anterior, **la base ya está migrada**. Por eso las migraciones tienen que
ser **compatibles hacia atrás**:

- Añadir tablas o columnas (con valor por defecto o que admitan vacío): sí.
- Borrar o renombrar algo que la versión anterior usa: **en dos despliegues**. Primero, una versión que deje de
  usarlo; en otro despliegue posterior, la migración que lo borra.

Antes de migrar siempre se hace una copia (si la copia falla, no se despliega): si una migración destroza algo,
`docs/RESTAURAR.md`.

## A mano

| Qué | Cómo |
|---|---|
| Qué versión está en marcha | `ssh -t portfolio 'sudo cat /etc/portfolio-despliegue/actual'` |
| Poner una versión concreta de `main` (por ejemplo, volver a una anterior) | `ssh -t portfolio 'sudo portfolio-desplegar <commit>'` (su imagen tiene que estar en ghcr.io) |
| Ver qué pasó | `ssh -t portfolio 'sudo journalctl -t portfolio-desplegar --since today'` |
| Cambiar la llave de GitHub | `sudo bash ~/5-despliegue.sh main` y responder "s" a crear una nueva; pegarla en el secreto `DESPLIEGUE_LLAVE` |

Si tampoco responde la versión anterior (el programa lo dice: "¡OJO!"), mirar
`sudo docker compose -f /srv/portfolio/infra/docker-compose.yml ps` y los registros de la API
(`… logs --tail 100 api`).

## La web (Vercel, GO-02)

La web no pasa por el servidor: **Vercel** la construye desde `apps/web` (proyecto con *Root Directory*
`apps/web`, plan Hobby) y la sirve en `mateorodriguez.solutions` (`www` redirige a ella).

```
push a main ──► Vercel: npm run build ──► producción
"Publicar" en el panel ──► API ──► gancho de Vercel ──► Vercel: npm run build ──► producción
PR ──► vista previa (protegida: solo con sesión de Vercel)
```

- **`npm run build`** congela el contenido publicado (`CONTENT_API_URL`), construye y genera una página por URL.
  Si la API no contesta, usa la copia del repo: la web se construye igual.
- **La copia del repo** (`apps/web/src/contenido/`, y los CV de `public/cv/`) es la rueda de repuesto: en Vercel se
  trae nueva en cada construcción, pero en git se queda como estaba. **Después de cambios grandes en el panel,
  refrescarla** en un PR (no es urgente): `CONTENT_API_URL=https://api.mateorodriguez.solutions node
  apps/web/scripts/congelar-contenido.mjs`. Última vez: GO-03, 07/11/2026.
- **`apps/web/vercel.json`**: cabeceras de seguridad (las mismas que la API, más `Permissions-Policy` y
  `Cross-Origin-Opener-Policy`; la CSP llega en GO-04), caché larga para `/assets/` (llevan huella en el nombre),
  y que cualquier dirección que no sea un archivo abra la web (el panel y el "no encontrado" los monta React; la
  ruta del panel no se puede escribir ahí, el repo es público). **Menos `/assets/`**: una pieza que no existe da
  404, no la portada (que además se guardaría un año con la caché de `/assets/`).
- **Una pestaña abierta de antes de publicar** pide piezas con el nombre viejo, que ya no existen. La pantalla de
  error de las rutas (`ErrorRuta`) recarga sola una vez en la dirección a la que ibas; si vuelve a fallar en
  menos de un minuto, enseña "Algo no ha cargado · Recargar" (#185).
- **Se construye con cada push a `main`, aunque solo cambie la API** (un minuto, gratis). Hubo un filtro para
  saltarse esas construcciones (*Ignored Build Step*) y se quitó: Vercel no distingue un push del gancho, y
  después de un commit que no tocaba `apps/web` se saltaba también la construcción de "Publicar" (probado en
  GO-02). El contenido no está en git, así que el filtro no puede saber que cambió. **"Publicar" manda.**
- **Variables** (en Vercel, Production): `VITE_API_URL`, `CONTENT_API_URL`, `VITE_UMAMI_URL`,
  `VITE_UMAMI_WEBSITE_ID` y `VITE_ADMIN_PATH`. Las `VITE_` acaban en el código que descarga el navegador: no
  pueden ser secretos.

### El gancho de "Publicar"

Es una dirección secreta (quien la tenga puede lanzar construcciones). Vive en `infra/api.env` del servidor
(`VERCEL_DEPLOY_HOOK`) y en Bitwarden. **Si se filtra:** en Vercel, *Settings → Git → Deploy Hooks*, bórralo y crea
otro; después `sudo bash ~/6-contenido.sh main` en el servidor (te pide el nuevo, sin que se vea).
