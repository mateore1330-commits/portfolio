#!/usr/bin/env bash
# INFRA-02 · Cortafuegos, fail2ban y actualizaciones (se ejecuta una vez, en el servidor).
#
#   sudo bash ~/infra-02.sh
#
# Lo ejecuta Mateo (sudo pide su contraseña). Se puede repetir sin romper nada. Sin secretos.
# Plan: Recursos/Planes/PLAN-INFRA-02.md.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Hay que ejecutarlo con sudo: sudo bash ~/infra-02.sh"
  exit 1
fi
export DEBIAN_FRONTEND=noninteractive

echo
echo "== 1/4 · Poner el sistema al día =="
# La lista de paquetes no se había descargado nunca: primero la lista, luego todo lo pendiente.
apt-get update -q
apt-get full-upgrade -y -q
apt-get autoremove -y -q

echo
echo "== 2/4 · Cortafuegos (ufw): solo 22, 80 y 443 =="
# Primero las reglas y después encenderlo: el 22 ya está abierto antes de que se cierre nada.
ufw default deny incoming     # entrar: prohibido salvo lo de abajo
ufw default allow outgoing    # salir (actualizaciones, correo, Cloudinary…): permitido
ufw allow 22/tcp comment 'SSH (solo con clave)'
ufw allow 80/tcp comment 'HTTP (Caddy, INFRA-04)'
ufw allow 443/tcp comment 'HTTPS (Caddy, INFRA-04)'
ufw --force enable
ufw status verbose

echo
echo "== 3/4 · fail2ban: bloquear a quien insiste en entrar por SSH =="
apt-get install -y -q fail2ban python3-systemd
cat > /etc/fail2ban/jail.d/portfolio.local <<'EOF'
# Portfolio (INFRA-02). 5 fallos en 10 minutos → 1 hora bloqueado; si repite, más tiempo
# (cada vez el doble, como mucho 1 semana).
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
bantime.increment = true
bantime.maxtime = 1w
ignoreip = 127.0.0.1/8 ::1

[sshd]
enabled = true
# Lee los intentos del registro del sistema (journald).
backend = systemd
EOF
systemctl enable fail2ban
systemctl restart fail2ban
sleep 3
fail2ban-client status sshd

echo
echo "== 4/4 · Actualizaciones de seguridad automáticas =="
# Ubuntu ya las trae encendidas (20auto-upgrades) y solo con parches de seguridad
# (50unattended-upgrades). Esto añade lo decidido: nunca reiniciar solo y limpiar lo viejo.
cat > /etc/apt/apt.conf.d/52portfolio-unattended <<'EOF'
// Portfolio (INFRA-02): el servidor NO se reinicia solo. Si un parche lo necesita, al entrar
// por SSH sale "*** System restart required ***" y se reinicia a mano.
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-New-Unused-Dependencies "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
EOF
grep -h "APT::Periodic" /etc/apt/apt.conf.d/20auto-upgrades
unattended-upgrade --dry-run 2>&1 | tail -3 || true

echo
echo "== Hecho =="
if [ -f /var/run/reboot-required ]; then
  echo "⚠ Las actualizaciones piden REINICIAR. Avisa a Claude antes de hacerlo."
else
  echo "No hace falta reiniciar."
fi
