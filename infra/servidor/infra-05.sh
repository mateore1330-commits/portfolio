#!/usr/bin/env bash
# INFRA-05 · Las copias cifradas de la base (se ejecuta en el servidor).
#
#   sudo bash ~/infra-05.sh [rama]        (por defecto, develop)
#
# Lo ejecuta Mateo (sudo pide su contraseña). Se puede repetir: lo que ya está configurado lo
# pregunta antes de cambiarlo. Las llaves y contraseñas se escriben aquí, en la terminal, sin que
# se vean: no pasan por el chat ni por el repo. Plan: PLAN-INFRA-05.md.
#
#   1. age y rclone, de Ubuntu.
#   2. Los scripts, a /usr/local/lib/portfolio-copias (de root: el temporizador los ejecuta como
#      root, así que nadie más debe poder cambiarlos; /srv/portfolio es de mateo).
#   3. La llave de Backblaze (comprobada de verdad: sube y NO borra) y la llave pública de age.
#   4. El correo de aviso (SMTP_* y CONTACT_TO en api.env, los mismos que usa la API).
#   5. El temporizador, y la primera copia.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Hay que ejecutarlo con sudo: sudo bash ~/infra-05.sh"
  exit 1
fi
export DEBIAN_FRONTEND=noninteractive
RAMA="${1:-develop}"
DESTINO=/srv/portfolio
USUARIO=mateo
LIB=/usr/local/lib/portfolio-copias
CONF=/etc/portfolio-copias
BUCKET=mateo-portfolio-copias
API_ENV="$DESTINO/infra/api.env"

leer() {  # pregunta sin que se vea lo que escribes
  local valor
  read -r -s -p "$1: " valor; echo >&2
  if [ -z "$valor" ]; then echo "Vacío. No toco nada." >&2; exit 1; fi
  printf '%s' "$valor"
}
preguntar() {  # pregunta viendo lo que escribes, con un valor por defecto
  local valor
  read -r -p "$1${2:+ [$2]}: " valor
  printf '%s' "${valor:-${2:-}}"
}
si() {  # ¿sí o no? (no, por defecto)
  local r
  read -r -p "$1 (s/N): " r
  [ "$r" = s ] || [ "$r" = S ]
}
poner() {  # cambia (o añade) CLAVE=valor en api.env; el valor va por el entorno, nunca en la orden
  CLAVE="$1" VALOR="$2" awk -F= '
    BEGIN { hecho = 0 }
    $1 == ENVIRON["CLAVE"] { print ENVIRON["CLAVE"] "=" ENVIRON["VALOR"]; hecho = 1; next }
    { print }
    END { if (!hecho) print ENVIRON["CLAVE"] "=" ENVIRON["VALOR"] }
  ' "$API_ENV" > "$API_ENV.nuevo"
  mv "$API_ENV.nuevo" "$API_ENV"
}
tiene() {  # ¿api.env ya tiene un valor para esta clave? (sin enseñarlo)
  grep -Eq "^$1=.+" "$API_ENV"
}

echo
echo "== 1/5 · El código (rama $RAMA) y los programas =="
sudo -u "$USUARIO" git -C "$DESTINO" fetch --quiet --prune origin
sudo -u "$USUARIO" git -C "$DESTINO" checkout --quiet "$RAMA"
sudo -u "$USUARIO" git -C "$DESTINO" pull --quiet --ff-only origin "$RAMA"
echo "Código en: $(sudo -u "$USUARIO" git -C "$DESTINO" log --oneline -1)"
apt-get install -y -q age rclone >/dev/null
echo "age $(age --version) · $(rclone version | head -1)"

echo
echo "== 2/5 · Los scripts, donde solo root puede cambiarlos =="
COPIAS_SRC="$DESTINO/infra/copias"
install -d -m 755 -o root -g root "$LIB"
install -m 755 -o root -g root "$COPIAS_SRC/copiar.sh" "$LIB/copiar.sh"
install -m 644 -o root -g root "$COPIAS_SRC/avisar.py" "$COPIAS_SRC/comprobar-llave.py" "$LIB/"
install -m 644 -o root -g root "$COPIAS_SRC/portfolio-copia.service" "$COPIAS_SRC/portfolio-copia-aviso.service" \
  "$COPIAS_SRC/portfolio-copia.timer" /etc/systemd/system/
install -d -m 700 -o root -g root "$CONF"
install -m 600 -o root -g root "$COPIAS_SRC/llave-publica.txt" "$CONF/llave-publica.txt"
echo "En $LIB y /etc/systemd/system. Llave pública: $(cat "$CONF/llave-publica.txt")"

echo
echo "== 3/5 · La llave de Backblaze (Bitwarden: \"Backblaze · llave del servidor\") =="
# Desde aquí, lo que se escriba solo lo puede leer root.
umask 077
if [ -f "$CONF/b2.env" ] && ! si "Ya hay una llave guardada. ¿Cambiarla?"; then
  echo "Se queda la que había."
else
  cuenta=$(leer "keyID (no se ve al escribir)")
  llave=$(leer "applicationKey (no se ve al escribir)")
  printf 'B2_CUENTA=%s\nB2_LLAVE=%s\nB2_BUCKET=%s\n' "$cuenta" "$llave" "$BUCKET" > "$CONF/b2.env.nuevo"
  unset cuenta llave
  mv "$CONF/b2.env.nuevo" "$CONF/b2.env"
fi
chmod 600 "$CONF/b2.env"
echo "Comprobando la llave de verdad (sube un archivo de prueba e intenta borrarlo)…"
( set -a; . "$CONF/b2.env"; set +a; python3 -I "$LIB/comprobar-llave.py" )

echo
echo "== 4/5 · El correo de aviso (el mismo buzón que el formulario de contacto) =="
if tiene SMTP_HOST && tiene SMTP_USER && tiene SMTP_PASSWORD && ! si "El correo ya está configurado. ¿Cambiarlo?"; then
  echo "Se queda el que había."
else
  poner SMTP_HOST "$(preguntar "Servidor SMTP" "smtp.hostinger.com")"
  poner SMTP_PORT "$(preguntar "Puerto (SSL)" "465")"
  usuario=$(preguntar "Buzón (tu dirección de correo)")
  if [ -z "$usuario" ]; then echo "Vacío. No toco nada."; exit 1; fi
  poner SMTP_USER "$usuario"
  contrasena=$(leer "Contraseña de ese buzón (no se ve al escribir)")
  poner SMTP_PASSWORD "$contrasena"
  unset contrasena
  poner CONTACT_TO "$(preguntar "¿A qué dirección llegan los avisos?" "$usuario")"
  unset usuario
  chown root:root "$API_ENV"
  chmod 600 "$API_ENV"
  echo "Guardado en api.env. La API también lo usa (formulario de contacto): la reinicio."
  (cd "$DESTINO/infra" && docker compose up -d --force-recreate --wait api)
fi
echo "Mandando un correo de PRUEBA…"
python3 -I "$LIB/avisar.py" --prueba

echo
umask 022
echo "== 5/5 · El despertador (cada noche, 04:00 de Madrid) y la primera copia =="
systemctl daemon-reload
systemctl enable --now portfolio-copia.timer
echo "Haciendo la primera copia ahora (unos segundos)…"
if systemctl start portfolio-copia.service; then
  journalctl -u portfolio-copia.service --since "-5min" --no-pager -o cat | tail -n 20
else
  echo "La primera copia ha FALLADO (y te habrá llegado el correo). Lo que dijo:"
  journalctl -u portfolio-copia.service --since "-5min" --no-pager -o cat | tail -n 30
  exit 1
fi
echo
systemctl list-timers portfolio-copia.timer --no-pager | head -2

echo
echo "== Hecho =="
