#!/usr/bin/env bash
# INFRA-03 · Docker y el portfolio en el servidor (se ejecuta en el servidor).
#
#   sudo bash ~/2-docker.sh [rama]        (por defecto, develop)
#
# Lo ejecuta Mateo (sudo pide su contraseña). Se puede repetir: no rehace lo que ya está y
# NUNCA pisa los secretos que ya existan. Sin secretos en el archivo. Plan: PLAN-INFRA-03.md.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Hay que ejecutarlo con sudo: sudo bash ~/2-docker.sh"
  exit 1
fi
export DEBIAN_FRONTEND=noninteractive
RAMA="${1:-develop}"
REPO="https://github.com/mateore1330-commits/portfolio.git"
DESTINO=/srv/portfolio
USUARIO=mateo
# La huella de la clave con la que Docker firma sus paquetes (docs.docker.com).
HUELLA_DOCKER=9DC858229FC7DD38854AE2D88D81803C0EBFCD88

echo
echo "== 1/4 · Docker, desde su repositorio oficial =="
if ! command -v docker >/dev/null; then
  apt-get update -q
  apt-get install -y -q ca-certificates curl gnupg git
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # Antes de fiarse del repositorio: que la clave descargada sea la de Docker.
  huella=$(gpg --show-keys --with-colons /etc/apt/keyrings/docker.asc | awk -F: '/^fpr/{print $10; exit}')
  if [ "$huella" != "$HUELLA_DOCKER" ]; then
    echo "La clave de Docker no coincide ($huella). Paro sin instalar nada."
    rm -f /etc/apt/keyrings/docker.asc
    exit 1
  fi
  echo "Clave de Docker comprobada: $huella"
  version=$(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
  cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $version
Components: stable
Signed-By: /etc/apt/keyrings/docker.asc
EOF
  apt-get update -q
  apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
else
  echo "Docker ya estaba instalado."
fi

# Registros con tope (3 × 10 MB por contenedor) y ningún contenedor puede ganar privilegios.
# Solo la primera vez: si ya existe, no se toca.
if [ ! -f /etc/docker/daemon.json ]; then
  cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" },
  "no-new-privileges": true
}
EOF
  systemctl restart docker
fi
systemctl enable --now docker containerd
docker --version
docker compose version

echo
echo "== 2/4 · El código, en $DESTINO (rama $RAMA) =="
# El repo es público: se clona sin credenciales. Es de mateo (para git pull sin sudo).
if [ ! -d "$DESTINO/.git" ]; then
  install -d -o "$USUARIO" -g "$USUARIO" "$DESTINO"
  sudo -u "$USUARIO" git clone --quiet --branch "$RAMA" "$REPO" "$DESTINO"
else
  sudo -u "$USUARIO" git -C "$DESTINO" fetch --quiet origin
  sudo -u "$USUARIO" git -C "$DESTINO" checkout --quiet "$RAMA"
  sudo -u "$USUARIO" git -C "$DESTINO" pull --quiet --ff-only origin "$RAMA"
fi
echo "Código en: $(sudo -u "$USUARIO" git -C "$DESTINO" log --oneline -1)"

echo
echo "== 3/4 · Los secretos, generados aquí (nunca se enseñan ni se pisan) =="
cd "$DESTINO/infra"
aleatorio() { openssl rand -hex 24; }
if [ ! -f .env ] && [ ! -f api.env ]; then
  umask 077
  pass_portfolio=$(aleatorio)
  {
    echo "POSTGRES_PASSWORD=$(aleatorio)"
    echo "PORTFOLIO_DB_PASSWORD=$pass_portfolio"
    echo "UMAMI_DB_PASSWORD=$(aleatorio)"
    echo "UMAMI_APP_SECRET=$(aleatorio)"
  } > .env
  sed -e "s|^SECRET_KEY=.*|SECRET_KEY=$(aleatorio)|" \
      -e "s|^DATABASE_URL=.*|DATABASE_URL=postgresql+psycopg2://portfolio:${pass_portfolio}@db:5432/portfolio|" \
      api.env.example > api.env
  unset pass_portfolio
  echo "Creados .env y api.env."
elif [ -f .env ] && [ -f api.env ]; then
  echo "Ya existían .env y api.env: no se tocan."
else
  echo "Solo existe uno de los dos (.env / api.env): paro para no dejarlos descuadrados."
  exit 1
fi
chown root:root .env api.env
chmod 600 .env api.env
ls -l .env api.env | awk '{print $1, $3, $NF}'

echo
echo "== 4/4 · Arrancar (la primera vez construye la imagen de la API: unos minutos) =="
docker compose up -d --build --wait
docker compose ps --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}"
echo
echo "Salud a través de Caddy: $(curl -s http://127.0.0.1/api/health)"

echo
echo "== Hecho =="
