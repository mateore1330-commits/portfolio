"""Manda el correo de aviso cuando falla la copia (INFRA-05). Lo lanza systemd
(portfolio-copia-aviso.service) si portfolio-copia termina mal, por la razón que sea.

Usa el mismo buzón que la API (SMTP_* y CONTACT_TO de /srv/portfolio/infra/api.env), igual que
api/correo.py: SMTP con SSL. Solo la biblioteca estándar.

    python3 avisar.py            el aviso de fallo
    python3 avisar.py --prueba   un correo de prueba (para ver que los avisos llegan)
"""

import os
import smtplib
import socket
import subprocess
import sys
from email.message import EmailMessage
from email.utils import formataddr

API_ENV = os.environ.get("API_ENV", "/srv/portfolio/infra/api.env")


def leer(ruta):
    """Las líneas CLAVE=valor del archivo (sin comillas ni comentarios)."""
    valores = {}
    with open(ruta, encoding="utf-8") as archivo:
        for linea in archivo:
            linea = linea.strip()
            if linea and not linea.startswith("#") and "=" in linea:
                clave, valor = linea.split("=", 1)
                valores[clave.strip()] = valor.strip()
    return valores


def registro():
    """Las últimas líneas de la copia, para saber qué ha pasado sin entrar."""
    try:
        return subprocess.run(
            ["journalctl", "-u", "portfolio-copia", "-n", "25", "--no-pager", "-o", "cat"],
            capture_output=True, text=True, timeout=20,
        ).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return "(no se pudo leer el registro)"


def main():
    prueba = "--prueba" in sys.argv
    mensaje = ("Esto es una prueba: así te llegará el aviso si una copia falla. No hay que hacer nada."
               if prueba else "La copia de la base de esta noche ha fallado.")
    c = leer(API_ENV)
    if not (c.get("SMTP_HOST") and c.get("SMTP_USER") and c.get("SMTP_PASSWORD")):
        sys.exit("El correo no está configurado en api.env (SMTP_HOST, SMTP_USER y SMTP_PASSWORD).")

    aviso = EmailMessage()
    aviso["Subject"] = ("Portfolio: prueba del aviso de las copias" if prueba
                        else "⚠ Portfolio: la copia de la base ha fallado")
    aviso["From"] = formataddr(("Portfolio · copias", c["SMTP_USER"]))
    aviso["To"] = c.get("CONTACT_TO") or c["SMTP_USER"]
    partes = [mensaje, f"Servidor: {socket.gethostname()}"]
    if not prueba:
        partes.append(f"Lo último que dijo:\n\n{registro()}")
    partes += [
        "Para ver qué ha pasado:\n  ssh -t portfolio 'sudo journalctl -u portfolio-copia --since today'",
        "Para repetirla a mano:\n  ssh -t portfolio 'sudo systemctl start portfolio-copia'",
    ]
    aviso.set_content("\n\n".join(partes) + "\n")
    with smtplib.SMTP_SSL(c["SMTP_HOST"], int(c.get("SMTP_PORT") or 465), timeout=20) as smtp:
        smtp.login(c["SMTP_USER"], c["SMTP_PASSWORD"])
        smtp.send_message(aviso)
    print(f"Aviso mandado a {aviso['To']}.")


if __name__ == "__main__":
    main()
