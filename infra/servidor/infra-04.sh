#!/usr/bin/env bash
# INFRA-04 · HTTPS con Caddy y el usuario de Umami de la API (se ejecuta en el servidor).
#
#   sudo bash ~/infra-04.sh [rama]           pone al día el código y recrea Caddy (pide los certificados)
#   sudo bash ~/infra-04.sh --umami [rama]   además, te pide el usuario de Umami de la API y lo guarda
#
# Lo ejecuta Mateo (sudo pide su contraseña). Se puede repetir. Las contraseñas se escriben aquí,
# en la terminal, sin que se vean: no pasan por el chat ni por el repo. Plan: PLAN-INFRA-04.md.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Hay que ejecutarlo con sudo: sudo bash ~/infra-04.sh"
  exit 1
fi
UMAMI=0
if [ "${1:-}" = "--umami" ]; then UMAMI=1; shift; fi
RAMA="${1:-develop}"
DESTINO=/srv/portfolio
USUARIO=mateo

echo
echo "== 1/3 · El código, rama $RAMA =="
sudo -u "$USUARIO" git -C "$DESTINO" fetch --quiet --prune origin
sudo -u "$USUARIO" git -C "$DESTINO" checkout --quiet "$RAMA"
sudo -u "$USUARIO" git -C "$DESTINO" pull --quiet --ff-only origin "$RAMA"
echo "Código en: $(sudo -u "$USUARIO" git -C "$DESTINO" log --oneline -1)"
cd "$DESTINO/infra"

if [ "$UMAMI" -eq 1 ]; then
  echo
  echo "== 2/3 · El usuario de Umami de la API (lo creaste antes en su panel, solo lectura) =="
  read -r -p "Usuario: " usuario
  read -r -s -p "Contraseña (no se ve al escribir): " contrasena; echo
  read -r -p "Website ID: " website
  if [ -z "$usuario" ] || [ -z "$contrasena" ] || [ -z "$website" ]; then
    echo "Falta algún dato. No toco nada."
    exit 1
  fi
  # Cambia (o añade) cada línea en api.env. Los valores van por el entorno, no por la orden:
  # así una contraseña con símbolos raros no rompe nada y no aparece en la lista de procesos.
  poner() {
    CLAVE="$1" VALOR="$2" awk -F= '
      BEGIN { hecho = 0 }
      $1 == ENVIRON["CLAVE"] { print ENVIRON["CLAVE"] "=" ENVIRON["VALOR"]; hecho = 1; next }
      { print }
      END { if (!hecho) print ENVIRON["CLAVE"] "=" ENVIRON["VALOR"] }
    ' api.env > api.env.nuevo
    chmod 600 api.env.nuevo
    mv api.env.nuevo api.env
  }
  poner UMAMI_URL "http://umami:3000"
  poner UMAMI_USUARIO "$usuario"
  poner UMAMI_CONTRASENA "$contrasena"
  poner UMAMI_WEBSITE_ID "$website"
  unset contrasena
  chown root:root api.env
  chmod 600 api.env
  echo "Guardado en api.env."
fi

echo
echo "== 3/3 · Arrancar (Caddy pide los certificados al arrancar: hasta un minuto) =="
docker compose up -d --build --wait
# El Caddyfile no cambia el contenedor: hay que recrearlo para que lo lea.
docker compose up -d --force-recreate --wait caddy
if [ "$UMAMI" -eq 1 ]; then
  docker compose up -d --force-recreate --wait api
fi
docker compose ps --format "table {{.Service}}\t{{.Status}}"
echo
echo "Esperando a los certificados…"
for _ in $(seq 1 12); do
  if curl -fs -m 5 https://api.mateorodriguez.solutions/api/health >/dev/null; then break; fi
  sleep 5
done
echo "Salud por HTTPS: $(curl -s -m 5 https://api.mateorodriguez.solutions/api/health || echo 'aún no responde')"

echo
echo "== Hecho =="
