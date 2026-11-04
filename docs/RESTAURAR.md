# Recuperar una copia de la base

> Cómo se hacen las copias: `docs/ARQUITECTURA.md` → Backups (INFRA-05). Este documento es para el
> día que haga falta **volver atrás**. Probado de verdad el 03/11/2026 con una copia bajada de
> Backblaze: 42 tablas, las mismas filas que el servidor.

## Qué hay y dónde

Cada noche (04:00, hora de Madrid) se copian las dos bases, `portfolio` y `umami`, en formato
`pg_dump -Fc`, **cerradas con age**. Cada copia es una carpeta `AAAA-MM-DD/` con
`portfolio.dump.age` y `umami.dump.age`.

| Dónde | Cuántas | Cómo llegar |
|---|---|---|
| Servidor, `/var/backups/portfolio/` | Las 7 últimas | `ssh portfolio` (las lee `mateo`, sin `sudo`) |
| Backblaze B2, bucket `mateo-portfolio-copias` (Ámsterdam) | `diarias/`: 7 días · `semanales/`: los domingos, 31 días | Web de Backblaze → Browse Files (cuenta de Mateo, con verificación en dos pasos) |
| Disco SSD de Mateo, carpeta `portfolio-copias/` | Todas las que ha bajado (no se borra nada) | `infra/copias/bajar-al-disco.sh` |
| Hostinger | Su copia semanal del servidor entero | hPanel → VPS → Copias de seguridad |

**La llave que abre las copias** (la privada de age) está en Bitwarden ("Copias portfolio · llave
age (privada)") y en el Mac de Mateo (`~/.config/age/portfolio-copias.txt`). **Nunca en el
servidor.** Sin ella las copias no se pueden abrir: si se pierde, no hay forma de recuperarlas.

Si la llave del Mac no está (Mac nuevo), se recrea desde Bitwarden:

```bash
mkdir -p ~/.config/age && pbpaste > ~/.config/age/portfolio-copias.txt && chmod 600 ~/.config/age/portfolio-copias.txt
# (con el contenido de la nota de Bitwarden copiado al portapapeles; después: pbcopy < /dev/null)
age-keygen -y ~/.config/age/portfolio-copias.txt    # debe dar la de infra/copias/llave-publica.txt
```

---

## A. Comprobar una copia en tu Mac (sin tocar el servidor)

Para ensayar, o para mirar qué había un día concreto. Hace falta `age` (`brew install age`) y Docker.

1. **Bajar la copia** a una carpeta, por ejemplo `~/restaurar/`, desde el sitio que convenga:
   - del servidor: `rsync -a portfolio:/var/backups/portfolio/AAAA-MM-DD/ ~/restaurar/`
   - de Backblaze: Browse Files → `diarias/AAAA-MM-DD/` → marcar los dos → Descargar (llega un `.zip`:
     descomprimirlo)
   - del disco: copiar `portfolio-copias/AAAA-MM-DD/`
2. **Un PostgreSQL vacío** (la misma versión que el servidor):
   ```bash
   docker run -d --name portfolio-restaurada -e POSTGRES_PASSWORD=solo-local postgres:18.6-alpine
   ```
3. **Abrir y cargar** cada base:
   ```bash
   for b in portfolio umami; do
     docker exec portfolio-restaurada createdb -U postgres $b
     age -d -i ~/.config/age/portfolio-copias.txt ~/restaurar/$b.dump.age \
       | docker exec -i portfolio-restaurada pg_restore -U postgres -d $b --no-owner --exit-on-error
   done
   ```
4. **Comparar** con el servidor (o con lo que se espere):
   ```bash
   bash infra/copias/contar-filas.sh portfolio-restaurada            # la recuperada
   ssh -t portfolio 'sudo bash ~/contar-filas.sh'                     # la del servidor
   ```
5. **Limpiar**: `docker rm -f portfolio-restaurada` y borrar `~/restaurar/`.

---

## B. Devolver una copia al servidor

Cuando la base del servidor se ha perdido o estropeado. **Sustituye lo que haya** por lo de la copia:
lo que pasara después de esa copia se pierde.

0. **Instantánea en hPanel** antes de nada.
1. **En tu Mac, abrir la copia** (el servidor no puede: no tiene la llave) y subirla ya abierta a
   tu carpeta del servidor:
   ```bash
   for b in portfolio umami; do
     age -d -i ~/.config/age/portfolio-copias.txt ~/restaurar/$b.dump.age > ~/restaurar/$b.dump
   done
   scp ~/restaurar/portfolio.dump ~/restaurar/umami.dump portfolio:~/
   ```
2. **En el servidor**, parar lo que usa la base, recrear las dos bases vacías y cargarlas:
   ```bash
   ssh -t portfolio
   cd /srv/portfolio/infra
   sudo docker compose stop api umami
   for b in portfolio umami; do
     sudo docker exec portfolio-db-1 dropdb -U postgres --if-exists "$b"
     sudo docker exec portfolio-db-1 createdb -U postgres -O "$b" "$b"
     sudo docker exec -i portfolio-db-1 pg_restore -U postgres -d "$b" --no-owner --role="$b" --exit-on-error < ~/"$b.dump"
   done
   sudo docker compose up -d --wait
   ```
   (Los usuarios `portfolio` y `umami` de PostgreSQL no se tocan: viven fuera de las bases y sus
   contraseñas están en `infra/.env`. `--role` hace que las tablas recuperadas sean suyas.)
3. **Comprobar**: `sudo bash ~/contar-filas.sh`, `https://api.mateorodriguez.solutions/api/health`, entrar
   al panel y mirar el contenido.
4. **Borrar las copias abiertas**, en el servidor y en el Mac: van sin cifrar.
   ```bash
   rm ~/portfolio.dump ~/umami.dump              # en el servidor
   rm ~/restaurar/*.dump                          # en el Mac
   ```

### Si el servidor entero ha desaparecido

1. Servidor nuevo: los pasos 0 a 3 de [infra/README.md](../infra/README.md) ("Montar un servidor desde cero").
   `2-docker.sh` genera contraseñas nuevas: no hace falta recuperar las viejas.
2. Las bases salen vacías al arrancar: seguir el apartado **B** con la última copia de Backblaze o
   del disco.
3. Los pasos 4 y 5 (`4-copias.sh` y `5-despliegue.sh`) para volver a tener copias y despliegue (las llaves
   de Backblaze están en Bitwarden; la de GitHub se crea nueva).

---

## Si llega el correo "la copia de la base ha fallado"

1. Leer lo que dice el correo (trae las últimas líneas del registro).
2. Más detalle: `ssh -t portfolio 'sudo journalctl -u portfolio-copia --since today'`.
3. Arreglado lo que fuera, repetirla a mano: `ssh -t portfolio 'sudo systemctl start portfolio-copia'`.

Las copias anteriores no se tocan cuando una falla.
