"""El aviso por correo de cada mensaje del formulario de contacto.

Sale de tu propio buzón (SMTP del proveedor del dominio; en Hostinger, smtp.hostinger.com
por el puerto 465) y te llega a ti, con "Responder" apuntando a quien escribió.
Sin dependencias: smtplib es de la biblioteca estándar de Python.
"""

import smtplib
from email.message import EmailMessage
from email.utils import formataddr

from flask import current_app

ESPERA_MAXIMA = 15  # segundos


class ErrorCorreo(Exception):
    """No se pudo enviar. El mensaje nunca lleva la contraseña."""


def configurado():
    c = current_app.config
    return bool(c["SMTP_HOST"] and c["SMTP_USER"] and c["SMTP_PASSWORD"])


def enviar_aviso(mensaje):
    """Envía el aviso de un ContactMessage. Lanza ErrorCorreo si falla o no está configurado."""
    c = current_app.config
    if not configurado():
        raise ErrorCorreo("el correo no está configurado (SMTP_HOST, SMTP_USER y SMTP_PASSWORD)")

    aviso = EmailMessage()
    aviso["Subject"] = f"[Portfolio] Nuevo mensaje de {mensaje.name}"
    aviso["From"] = formataddr(("Portfolio", c["SMTP_USER"]))
    aviso["To"] = c["CONTACT_TO"] or c["SMTP_USER"]
    aviso["Reply-To"] = formataddr((mensaje.name, mensaje.email))
    aviso.set_content(
        f"De: {mensaje.name} <{mensaje.email}>\n"
        f"Asunto: {mensaje.subject or '(sin asunto)'}\n"
        f"Idioma de la web: {mensaje.locale or '?'}\n"
        f"Recibido: {mensaje.created_at:%d/%m/%Y %H:%M} (UTC)\n"
        "\n"
        f"{mensaje.message}\n"
        "\n"
        "—\n"
        "Responde a este correo para contestarle directamente.\n"
    )

    try:
        with smtplib.SMTP_SSL(c["SMTP_HOST"], c["SMTP_PORT"], timeout=ESPERA_MAXIMA) as smtp:
            smtp.login(c["SMTP_USER"], c["SMTP_PASSWORD"])
            smtp.send_message(aviso)
    except (smtplib.SMTPException, OSError) as error:
        raise ErrorCorreo(f"no se pudo enviar ({type(error).__name__})") from None
