#!/usr/bin/env bash
# La copia de cada noche (INFRA-05). La lanza el temporizador portfolio-copia.timer, como root.
#
#   1. pg_dump de "portfolio" y de "umami" (el contenedor portfolio-db-1).
#   2. Cifrado con la llave PÚBLICA (age): el servidor puede cerrar, pero no abrir.
#   3. Dentro: /var/backups/portfolio/AAAA-MM-DD/ (las 7 últimas). Legibles por mateo para
#      bajarlas a su disco: van cifradas.
#   4. Fuera: Backblaze B2, en diarias/AAAA-MM-DD/ (y los domingos también en semanales/). Lo
#      viejo lo borra Backblaze con sus reglas de caducidad: la llave del servidor no puede borrar.
#   5. Si algo falla (aquí o donde sea), systemd lanza portfolio-copia-aviso: un correo.
#
# Instalado por infra/servidor/4-copias.sh en /usr/local/lib/portfolio-copias (solo root puede
# cambiarlo). La configuración, en /etc/portfolio-copias/ (root, 600).
set -Eeuo pipefail

CONF=${CONF:-/etc/portfolio-copias}
COPIAS=${COPIAS:-/var/backups/portfolio}
CONTENEDOR=${CONTENEDOR:-portfolio-db-1}
GRUPO=${GRUPO:-mateo}
GUARDAR=7
BASES=(portfolio umami)

fecha=$(TZ=Europe/Madrid date +%F)
destino="$COPIAS/$fecha"
llave=$(cat "$CONF/llave-publica.txt")
umask 027
install -d -m 750 -o root -g "$GRUPO" "$COPIAS"
temporal=$(mktemp -d "$COPIAS/.en-curso.XXXXXX")
# Si algo falla a medias, que no quede nada a medias.
trap 'if [ -d "$temporal" ]; then rm -r "$temporal"; fi' EXIT

echo "== Volcar y cifrar ($fecha)"
for base in "${BASES[@]}"; do
  docker exec "$CONTENEDOR" pg_dump -U postgres -Fc "$base" | age -r "$llave" > "$temporal/$base.dump.age"
  # Un volcado vacío o mínimo es un fallo aunque nadie se haya quejado.
  if [ "$(stat -c %s "$temporal/$base.dump.age")" -lt 1024 ]; then
    echo "El volcado de $base ha salido vacío." >&2
    false
  fi
  echo "  $base: $(du -h "$temporal/$base.dump.age" | cut -f1)"
done
chgrp -R "$GRUPO" "$temporal"
chmod 750 "$temporal"
chmod 640 "$temporal"/*
# Si ya había una de hoy (una copia a mano), la nueva la sustituye.
if [ -d "$destino" ]; then
  find "$destino" -mindepth 1 -delete
  rmdir "$destino"
fi
mv "$temporal" "$destino"

echo "== Subir a Backblaze"
# rclone lee la llave del entorno: nunca va en la orden ni en un archivo de rclone.
set -a
# shellcheck source=/dev/null
. "$CONF/b2.env"
set +a
export RCLONE_CONFIG_B2_TYPE=b2 RCLONE_CONFIG_B2_ACCOUNT="$B2_CUENTA" RCLONE_CONFIG_B2_KEY="$B2_LLAVE"
# Para probarlo sin Backblaze, REMOTO puede ser una carpeta.
REMOTO=${REMOTO:-b2:$B2_BUCKET}
subir() {
  # --no-check-dest: no lista lo que hay (la llave solo escribe). Sin borrar nunca nada.
  rclone copy "$destino" "$REMOTO/$1/$fecha" --no-check-dest --b2-hard-delete=false --retries 5 --stats-log-level NOTICE
  echo "  $1/$fecha: subida."
}
subir diarias
if [ "$(TZ=Europe/Madrid date +%u)" = 7 ]; then
  subir semanales
fi

echo "== Dentro del servidor, solo las $GUARDAR últimas"
find "$COPIAS" -mindepth 1 -maxdepth 1 -type d -name '20??-??-??' | sort | head -n -"$GUARDAR" | while read -r vieja; do
  find "$vieja" -mindepth 1 -delete
  rmdir "$vieja"
  echo "  Borrada: $(basename "$vieja")"
done

echo "== Hecho: $(ls "$COPIAS" | tr '\n' ' ')"
