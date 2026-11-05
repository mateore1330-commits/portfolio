# El servidor

Todo lo que corre en el VPS: la API, PostgreSQL, Umami y Caddy en Docker, las copias de la base y el
despliegue automático. Aquí no hay secretos: los genera o los pide cada script en el servidor.

| Carpeta / archivo | Qué es |
|---|---|
| `docker-compose.yml` | Los cuatro contenedores: `caddy`, `api`, `db` (PostgreSQL 18) y `umami`. Solo Caddy publica puertos |
| `Caddyfile` | HTTPS con Let's Encrypt: `api.` → la API; `visitas.` → solo el contador de Umami |
| `db/crear-bases.sh` | Al crear la base por primera vez: las bases y los usuarios de `portfolio` y `umami` |
| `.env.example` · `api.env.example` | Las plantillas de los secretos (en el servidor, de root y con permisos 600) |
| `servidor/` | Los scripts para montar el servidor, **en orden** (abajo) |
| `copias/` | La copia de cada noche (cifrada con age, a Backblaze B2) — [docs/RESTAURAR.md](../docs/RESTAURAR.md) |
| `despliegue/` | El programa que pone una versión nueva de la API — [docs/DESPLIEGUE.md](../docs/DESPLIEGUE.md) |

Cómo encaja todo: [docs/ARQUITECTURA.md](../docs/ARQUITECTURA.md) (sección "Despliegue e infraestructura").

---

## Montar un servidor desde cero

Lo que se hizo con el servidor actual, en orden. Cada script **se lee antes de ejecutarlo**, se copia al
servidor y se ejecuta con `sudo`; se puede repetir sin estropear nada. Antes de cada paso delicado, **una
instantánea** en el panel del proveedor.

### 0 · El servidor y la entrada (a mano)

1. **Una llave SSH en el Mac**, con contraseña y guardada en el llavero:
   ```bash
   ssh-keygen -t ed25519 -C "mateo@portfolio" -f ~/.ssh/portfolio
   ssh-add --apple-use-keychain ~/.ssh/portfolio
   ```
2. **Contratar el VPS** (hoy, Hostinger KVM 2 en Francia) con **Ubuntu 26.04 LTS**, sin paneles ni aplicaciones, y
   con la llave pública (`~/.ssh/portfolio.pub`). La cuenta del proveedor, con verificación en dos pasos.
3. **Entrar como root** y dejarlo listo para `mateo`:
   ```bash
   apt update && apt -y full-upgrade
   adduser --disabled-password --gecos "" mateo && usermod -aG sudo mateo
   passwd mateo                     # su contraseña (la pide sudo): en el gestor de contraseñas
   install -d -m 700 -o mateo -g mateo /home/mateo/.ssh
   cp ~/.ssh/authorized_keys /home/mateo/.ssh/ && chown mateo:mateo /home/mateo/.ssh/authorized_keys
   ```
4. **SSH solo con llave y solo `mateo`**, en `/etc/ssh/sshd_config.d/00-portfolio.conf` (empieza por `00` para
   mandar sobre los archivos del proveedor):
   ```
   PermitRootLogin no
   PasswordAuthentication no
   KbdInteractiveAuthentication no
   PubkeyAuthentication yes
   AuthenticationMethods publickey
   AllowUsers mateo
   MaxAuthTries 3
   LoginGraceTime 30
   X11Forwarding no
   ```
   `sshd -t && systemctl reload ssh`, y **comprobar en otra terminal que `mateo` entra** antes de cerrar la de root.
5. **El atajo en el Mac** (`~/.ssh/config`): un bloque `Host portfolio` con la IP, `User mateo`,
   `IdentityFile ~/.ssh/portfolio`, `UseKeychain yes` y `AddKeysToAgent yes`. La IP, **nunca en el repo**.

### 1 · Seguridad — `servidor/1-seguridad.sh`

Cortafuegos `ufw` (solo 22, 80 y 443), `fail2ban` para SSH y las actualizaciones de seguridad automáticas (sin
reiniciar solo). **Y en el panel del proveedor**, su cortafuegos con las mismas tres reglas (Accept TCP 22, 80 y
443; Drop el resto): Docker se salta `ufw`, ese no.

### 2 · Docker y el portfolio — `servidor/2-docker.sh [rama]`

Docker desde su repositorio oficial (comprobando la huella de su clave), el código en `/srv/portfolio`, los
secretos generados allí al azar (`infra/.env`, `infra/api.env`) y arranca los cuatro contenedores.

### 3 · HTTPS y Umami — `servidor/3-https.sh [--umami] [rama]`

Antes, en los DNS del dominio: dos registros **A**, `api` y `visitas`, con la IP del servidor. El script recrea
Caddy, que pide los certificados. Con `--umami`: cambia la contraseña de `admin`, da de alta la web y crea el
usuario de solo lectura de la API (`umami-configurar.py`). El panel de Umami solo se abre por un túnel:
`ssh -N -L 8081:127.0.0.1:8081 portfolio` → `http://localhost:8081`.

### 4 · Copias — `servidor/4-copias.sh [rama]`

Antes: la llave de age en el Mac (`age-keygen`; la pública en `copias/llave-publica.txt`, la privada en el gestor
de contraseñas), la cuenta de Backblaze B2 (región EU Central, verificación en dos pasos) con un bucket privado y
sus reglas de caducidad, y la llave del servidor creada con `python3 infra/copias/crear-llave.py` (solo puede
listar y subir). El script la comprueba de verdad, configura el correo de aviso y hace la primera copia.

### 5 · Despliegue automático — `servidor/5-despliegue.sh [rama]`

El usuario `despliegue`, que solo puede lanzar `portfolio-desplegar`, y su llave: se enseña una vez para
guardarla en GitHub (Settings → Environments → `produccion` → `DESPLIEGUE_LLAVE`, con `DESPLIEGUE_HOST` y
`DESPLIEGUE_HUELLA`). Desde ahí, lo que se fusiona en `main` se despliega solo.

### 6 · El contenido y las llaves de la API — `servidor/6-contenido.sh [rama]`

Guarda en `api.env`, sin que se vean, el token de GitHub (el gráfico de contribuciones), la `CLOUDINARY_URL` y el
gancho de Vercel (que "Publicar" reconstruya la web: GO-02). La primera vez carga la semilla con tu usuario del
panel; después ya no (pisaría lo editado desde el panel). Publica y comprueba desde fuera. Se puede repetir: lo
que ya está, lo pregunta antes de cambiarlo.

### Y para recuperar los datos

Con el servidor ya montado, la última copia: [docs/RESTAURAR.md](../docs/RESTAURAR.md) (apartado B).
