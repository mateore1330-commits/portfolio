#!/usr/bin/env bash
# INFRA-04 · HTTPS con Caddy y el usuario de Umami de la API (se ejecuta en el servidor).
#
#   sudo bash ~/infra-04.sh [rama]           pone al día el código y recrea Caddy (pide los certificados)
#   sudo bash ~/infra-04.sh --umami [rama]   además, deja Umami listo: cambia la contraseña de admin,
#                                            da de alta la web y crea el usuario de solo lectura de la
#                                            API (umami-configurar.py), y lo guarda en api.env
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

echo
echo "== 2/3 · Arrancar (Caddy pide los certificados al arrancar: hasta un minuto) =="
docker compose up -d --build --wait
# El Caddyfile no cambia el contenedor: hay que recrearlo para que lo lea.
docker compose up -d --force-recreate --wait caddy
docker compose ps --format "table {{.Service}}\t{{.Status}}"
echo
echo "Esperando a los certificados…"
for _ in $(seq 1 12); do
  if curl -fs -m 5 https://api.mateorodriguez.solutions/api/health >/dev/null; then break; fi
  sleep 5
done
echo "Salud por HTTPS: $(curl -s -m 5 https://api.mateorodriguez.solutions/api/health || echo 'aún no responde')"

if [ "$UMAMI" -eq 1 ]; then
  echo
  echo "== 3/3 · Umami: tú escribes las contraseñas (las de Bitwarden); no se ven al escribir =="
  umask 077
  leer() {  # pide una contraseña sin que se vea; si $2 = 2, dos veces para no equivocarse
    local a b
    read -r -s -p "$1: " a; echo >&2
    if [ "${2:-1}" = 2 ]; then
      read -r -s -p "$1 (otra vez): " b; echo >&2
      if [ "$a" != "$b" ]; then echo "No coinciden. No toco nada." >&2; exit 1; fi
    fi
    if [ -z "$a" ]; then echo "Vacía. No toco nada." >&2; exit 1; fi
    printf '%s' "$a"
  }
  ADMIN_ACTUAL=$(leer "Contraseña ACTUAL de admin en Umami (la primera vez: umami)")
  # Si ya la cambiaste en una vez anterior, escribe la misma: no cambia nada.
  ADMIN_NUEVA=$(leer "Contraseña NUEVA de admin" 2)
  LECTOR_PASS=$(leer "Contraseña del usuario de la API (api-portfolio)" 2)
  export ADMIN_ACTUAL ADMIN_NUEVA LECTOR_PASS LECTOR=api-portfolio UMAMI=http://127.0.0.1:8081
  salida=$(python3 -I "$DESTINO/infra/servidor/umami-configurar.py") || { echo "$salida"; exit 1; }
  echo "$salida" | grep -v '^WEBSITE_ID='
  website=$(echo "$salida" | sed -n 's/^WEBSITE_ID=//p')

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
  poner UMAMI_USUARIO "$LECTOR"
  poner UMAMI_CONTRASENA "$LECTOR_PASS"
  poner UMAMI_WEBSITE_ID "$website"
  unset ADMIN_ACTUAL ADMIN_NUEVA LECTOR_PASS
  chown root:root api.env
  chmod 600 api.env
  echo "Guardado en api.env. Website ID (no es secreto, para Vercel en GO-02): $website"
  docker compose up -d --force-recreate --wait api
fi

echo
echo "== Hecho =="
