#!/usr/bin/env bash
# GO-03 · El contenido real en el servidor (se ejecuta en el servidor).
#
#   sudo bash ~/6-contenido.sh [rama]        (por defecto, main)
#
# Lo ejecuta Mateo (sudo pide su contraseña). Se puede repetir: lo que ya está lo pregunta antes
# de cambiarlo, y la semilla NO se vuelve a cargar si ya hay algo publicado (pisaría lo editado
# desde el panel). Las contraseñas y llaves se escriben aquí, sin que se vean. Plan: PLAN-GO-03.md.
#
#   1. El código.
#   2. Las llaves de la API en api.env: GitHub (el gráfico de contribuciones) y Cloudinary (las
#      imágenes que se suban desde el panel).
#   3. La semilla (tu contenido) y tu usuario del panel.
#   4. Publicar: la instantánea, los CV en PDF y el aviso a Vercel (si ya está).
#   5. Comprobar desde fuera lo que sirve la API.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Hay que ejecutarlo con sudo: sudo bash ~/6-contenido.sh"
  exit 1
fi
RAMA="${1:-main}"
DESTINO=${DESTINO:-/srv/portfolio}
USUARIO=mateo
API_ENV="$DESTINO/infra/api.env"
API_URL=${API_URL:-https://api.mateorodriguez.solutions}
read -r -a CURL_EXTRA <<<"${CURL_EXTRA:-}"  # solo para probarlo en local

leer() {  # pregunta sin que se vea; si $2 = 2, dos veces; vacío = nada
  local a b
  read -r -s -p "$1: " a; echo >&2
  if [ -n "$a" ] && [ "${2:-1}" = 2 ]; then
    read -r -s -p "$1 (otra vez): " b; echo >&2
    if [ "$a" != "$b" ]; then echo "No coinciden. No toco nada." >&2; exit 1; fi
  fi
  printf '%s' "$a"
}
preguntar() { local v; read -r -p "$1${2:+ [$2]}: " v; printf '%s' "${v:-${2:-}}"; }
si() { local r; read -r -p "$1 (s/N): " r; [ "$r" = s ] || [ "$r" = S ]; }
tiene() { grep -Eq "^$1=.+" "$API_ENV"; }
poner() {  # cambia (o añade) CLAVE=valor en api.env; el valor va por el entorno, nunca en la orden
  CLAVE="$1" VALOR="$2" awk -F= '
    BEGIN { hecho = 0 }
    $1 == ENVIRON["CLAVE"] { print ENVIRON["CLAVE"] "=" ENVIRON["VALOR"]; hecho = 1; next }
    { print }
    END { if (!hecho) print ENVIRON["CLAVE"] "=" ENVIRON["VALOR"] }
  ' "$API_ENV" | (umask 077 && cat > "$API_ENV.nuevo")
  chmod 600 "$API_ENV.nuevo"
  mv "$API_ENV.nuevo" "$API_ENV"
}
compose() { (cd "$DESTINO/infra" && docker compose "$@"); }
sql() { compose exec -T db psql -U postgres -d portfolio -tAc "$1"; }

echo
echo "== 1/5 · El código (rama $RAMA) =="
if [ -z "${SALTAR_GIT:-}" ]; then
  sudo -u "$USUARIO" git -C "$DESTINO" fetch --quiet --prune origin
  sudo -u "$USUARIO" git -C "$DESTINO" checkout --quiet "$RAMA"
  sudo -u "$USUARIO" git -C "$DESTINO" pull --quiet --ff-only origin "$RAMA"
fi
echo "Código en: $(git -C "$DESTINO" log --oneline -1)"

echo
echo "== 2/5 · Las llaves de la API (Enter para dejar una para más adelante) =="
cambiado=no
if tiene GITHUB_TOKEN && ! si "Ya hay un token de GitHub. ¿Cambiarlo?"; then
  echo "GitHub: se queda el que había."
else
  token=$(leer "Token de GitHub del servidor (Bitwarden: \"GitHub · token del servidor\"; no se ve)")
  if [ -n "$token" ]; then
    case "$token" in
      github_pat_*|ghp_*) ;;
      *) echo "No parece un token de GitHub (github_pat_… o ghp_…). No toco nada."; exit 1 ;;
    esac
    poner GITHUB_TOKEN "$token"
    poner GITHUB_LOGIN "$(preguntar "Tu usuario de GitHub" "mateore1330-commits")"
    cambiado=si
    echo "GitHub: guardado."
  fi
  unset token
fi
if tiene CLOUDINARY_URL && ! si "Ya hay Cloudinary. ¿Cambiarlo?"; then
  echo "Cloudinary: se queda el que había."
else
  nube=$(leer "CLOUDINARY_URL, cloudinary://… (la de tu .env del Mac; no se ve)")
  if [ -n "$nube" ]; then
    case "$nube" in
      cloudinary://*) ;;
      *) echo "No parece una CLOUDINARY_URL (cloudinary://…). No toco nada."; exit 1 ;;
    esac
    poner CLOUDINARY_URL "$nube"
    cambiado=si
    echo "Cloudinary: guardado."
  fi
  unset nube
fi
chown root:root "$API_ENV"
chmod 600 "$API_ENV"
if [ "$cambiado" = si ]; then
  echo "Reinicio la API para que lea las llaves…"
  compose up -d --force-recreate --wait api
fi

echo
echo "== 3/5 · Tu contenido (la semilla) y tu usuario del panel =="
publicadas=$(sql "select count(*) from snapshots" | tr -d '[:space:]')
if [ "$publicadas" != 0 ]; then
  echo "Ya hay $publicadas publicación(es): la semilla NO se vuelve a cargar (pisaría lo editado"
  echo "desde el panel). El contenido se cambia desde el panel."
else
  administradores=$(sql "select count(*) from admin_users" | tr -d '[:space:]')
  if [ "$administradores" = 0 ]; then
    ADMIN_EMAIL=$(preguntar "Correo para entrar al panel")
    ADMIN_PASSWORD=$(leer "Contraseña del panel (Bitwarden; 12 caracteres o más; no se ve)" 2)
    if [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_PASSWORD" ]; then
      echo "Hacen falta el correo y la contraseña. No toco nada."
      exit 1
    fi
    # Por el entorno (-e NOMBRE, sin valor): no aparecen en la lista de procesos del servidor.
    export ADMIN_EMAIL ADMIN_PASSWORD
  else
    echo "Ya hay usuario del panel: la semilla no lo toca."
  fi
  compose exec -T -e ADMIN_EMAIL -e ADMIN_PASSWORD api python seed/cargar.py
  unset ADMIN_EMAIL ADMIN_PASSWORD
fi

echo
echo "== 4/5 · Publicar =="
compose exec -T api python seed/publicar.py

echo
echo "== 5/5 · Comprobar desde fuera =="
contenido=$(curl -fsS -m 20 "${CURL_EXTRA[@]}" "$API_URL/api/content")
python3 - "$contenido" <<'PY'
import json, sys
c = json.loads(sys.argv[1])
print(f"Contenido: {len(c['projects'])} proyectos ({', '.join(p['name']['es'] for p in c['projects'])}) · "
      f"{len(c['jobs'])} empleos · {len(c['education'])} formaciones · {len(c['links'])} enlaces")
PY
for lang in es en; do
  echo "CV $lang: $(curl -s -o /dev/null -m 30 "${CURL_EXTRA[@]}" -w '%{http_code} · %{size_download} bytes' "$API_URL/api/cv/$lang.pdf")"
done
echo "Contribuciones de GitHub: $(curl -s -o /dev/null -m 60 "${CURL_EXTRA[@]}" -w '%{http_code}' "$API_URL/api/contributions") (200 = con datos)"
echo "En la base: $(sql "select count(*) from admin_users") usuario(s) del panel · $(sql "select count(*) from contact_messages") mensajes · $(sql "select count(*) from snapshots") publicación(es)"

echo
echo "== Hecho =="
