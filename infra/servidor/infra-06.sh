#!/usr/bin/env bash
# INFRA-06 · El despliegue automático (se ejecuta en el servidor).
#
#   sudo bash ~/infra-06.sh [rama]        (por defecto, develop)
#
# Lo ejecuta Mateo (sudo pide su contraseña). Se puede repetir. Plan: PLAN-INFRA-06.md.
#
#   1. portfolio-desplegar, a /usr/local/sbin (de root).
#   2. El usuario "despliegue": sin contraseña, su casa de root (no puede cambiar nada suyo) y
#      sh como intérprete (no lee archivos de arranque).
#   3. Su llave: SOLO puede lanzar portfolio-desplegar (orden forzada en authorized_keys y en
#      sshd), sin terminal, sin túneles. sudo, solo para ese programa.
#   4. La llave se crea AQUÍ y la privada se enseña UNA vez para pegarla en GitHub; después se
#      borra. Solo vive en los secretos de GitHub.
#   5. Prueba: con esa llave no se puede hacer otra cosa.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Hay que ejecutarlo con sudo: sudo bash ~/infra-06.sh"
  exit 1
fi
RAMA="${1:-develop}"
DESTINO=/srv/portfolio
USUARIO=mateo
CUENTA=despliegue
PROGRAMA=/usr/local/sbin/portfolio-desplegar
CASA=/var/lib/despliegue
SSHD=/etc/ssh/sshd_config.d/00-portfolio.conf
SSHD_DESPLIEGUE=/etc/ssh/sshd_config.d/10-despliegue.conf
SUDOERS=/etc/sudoers.d/portfolio-despliegue
ORDEN="sudo -n $PROGRAMA \"\$SSH_ORIGINAL_COMMAND\""

si() { local r; read -r -p "$1 (s/N): " r; [ "$r" = s ] || [ "$r" = S ]; }

echo
echo "== 1/5 · El código (rama $RAMA) y el programa de despliegue =="
sudo -u "$USUARIO" git -C "$DESTINO" fetch --quiet --prune origin
sudo -u "$USUARIO" git -C "$DESTINO" checkout --quiet "$RAMA"
sudo -u "$USUARIO" git -C "$DESTINO" pull --quiet --ff-only origin "$RAMA"
echo "Código en: $(sudo -u "$USUARIO" git -C "$DESTINO" log --oneline -1)"
install -m 755 -o root -g root "$DESTINO/infra/despliegue/portfolio-desplegar" "$PROGRAMA"
echo "Instalado: $PROGRAMA"

echo
echo "== 2/5 · El usuario $CUENTA =="
if ! id "$CUENTA" >/dev/null 2>&1; then
  useradd --system --home-dir "$CASA" --no-create-home --shell /bin/sh "$CUENTA"
  echo "Creado."
fi
usermod --shell /bin/sh --home "$CASA" "$CUENTA"
# Sin contraseña (ni siquiera vacía): solo se entra con la llave.
usermod -p '*' "$CUENTA"
# Su casa y su .ssh son de root: no puede cambiar su propia llave ni dejarse archivos.
install -d -m 755 -o root -g root "$CASA" "$CASA/.ssh"
echo "$(id "$CUENTA") · casa $CASA (de root) · intérprete /bin/sh"

echo
echo "== 3/5 · Lo único que puede hacer: lanzar el despliegue =="
# sudo, solo para el programa (y sin contraseña: GitHub no la tiene).
printf '# INFRA-06: el usuario despliegue solo puede lanzar el despliegue.\n%s ALL=(root) NOPASSWD: %s\n' \
  "$CUENTA" "$PROGRAMA" > "$SUDOERS.nuevo"
chmod 440 "$SUDOERS.nuevo"
if visudo -c -f "$SUDOERS.nuevo" >/dev/null; then
  mv "$SUDOERS.nuevo" "$SUDOERS"
else
  rm -f "$SUDOERS.nuevo"
  echo "La regla de sudo no es válida. No toco nada."
  exit 1
fi
# sshd: puede entrar, pero solo con llave y solo para el despliegue (aunque la llave dijera otra cosa).
cp -p "$SSHD" "$SSHD.antes"
sed -i -E "s/^AllowUsers .*/AllowUsers $USUARIO $CUENTA/" "$SSHD"
cat > "$SSHD_DESPLIEGUE" <<EOF
# INFRA-06: el usuario despliegue (GitHub Actions) solo lanza portfolio-desplegar.
Match User $CUENTA
    AuthenticationMethods publickey
    ForceCommand $ORDEN
    PermitTTY no
    AllowTcpForwarding no
    AllowAgentForwarding no
    AllowStreamLocalForwarding no
    X11Forwarding no
    PermitTunnel no
# Que lo de arriba no se cuele en lo que venga detrás.
Match all
EOF
chmod 644 "$SSHD_DESPLIEGUE"
if sshd -t; then
  systemctl reload ssh
  rm -f "$SSHD.antes"
  echo "sshd: $(grep -E '^AllowUsers' "$SSHD") · orden forzada para $CUENTA."
else
  mv "$SSHD.antes" "$SSHD"
  rm -f "$SSHD_DESPLIEGUE"
  echo "La configuración de sshd no es válida: la dejo como estaba. No sigo."
  exit 1
fi

echo
echo "== 4/5 · La llave de GitHub =="
LLAVES="$CASA/.ssh/authorized_keys"
if [ -s "$LLAVES" ] && ! si "Ya hay una llave de despliegue. ¿Crear una nueva (la de GitHub dejará de valer)?"; then
  echo "Se queda la que había."
else
  temporal=$(mktemp -d)
  ssh-keygen -q -t ed25519 -N "" -C "despliegue-github-$(date +%F)" -f "$temporal/llave"
  printf 'restrict,command="%s" %s\n' "${ORDEN//\"/\\\"}" "$(cat "$temporal/llave.pub")" > "$LLAVES"
  chown root:root "$LLAVES"
  chmod 644 "$LLAVES"
  echo
  echo "Copia TODO lo que hay entre las dos rayas (incluidas las líneas BEGIN y END) y pégalo en"
  echo "GitHub → Settings → Environments → produccion → secreto DESPLIEGUE_LLAVE."
  echo "No se vuelve a enseñar y no se guarda en ningún otro sitio."
  echo "------------------------------------------------------------------------------"
  cat "$temporal/llave"
  echo "------------------------------------------------------------------------------"
  shred -u "$temporal/llave" 2>/dev/null || rm -f "$temporal/llave"
  rm -rf "$temporal"
  read -r -p "Cuando la hayas pegado en GitHub, pulsa Enter (después, limpia la terminal con Cmd + K)… " _
fi

echo
echo "== 5/5 · Prueba: con esa llave no se puede hacer otra cosa =="
# Lo que hace sshd con la orden forzada, como el usuario despliegue: una orden cualquiera
# tiene que acabar rechazada por portfolio-desplegar.
salida=$(SSH_ORIGINAL_COMMAND="cat /etc/shadow" sudo -u "$CUENTA" /bin/sh -c "$ORDEN" 2>&1 || true)
if grep -q "Rechazado" <<<"$salida" && ! grep -q "root:" <<<"$salida"; then
  echo "Bien: «cat /etc/shadow» → rechazado (solo acepta un commit)."
else
  echo "MAL: la orden forzada no se comporta como debe. Avisa a Claude."
  exit 1
fi
if sudo -u "$CUENTA" sudo -n /bin/true 2>/dev/null; then
  echo "MAL: despliegue puede usar sudo para otras cosas. Avisa a Claude."
  exit 1
fi
echo "Bien: sudo solo le deja lanzar el despliegue."
echo
echo "La huella de este servidor (la comprueba Claude desde tu Mac; va en DESPLIEGUE_HUELLA):"
awk '{print $1, $2}' /etc/ssh/ssh_host_ed25519_key.pub

echo
echo "== Hecho =="
