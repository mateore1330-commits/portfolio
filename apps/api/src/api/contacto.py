"""El formulario de contacto: validación, antispam y guardado.

Orden: primero se GUARDA el mensaje y se responde; el aviso por correo se envía después,
en segundo plano. Si el correo falla o tarda, el mensaje ya está a salvo (email_sent
queda en falso) y el visitante no espera: `pipenv run reenviar-avisos` lo reintenta.
"""

import re
import threading
from datetime import UTC, datetime, timedelta

from flask import current_app
from sqlalchemy import func, select

from .correo import ErrorCorreo, enviar_aviso
from .extensions import db
from .models import ContactMessage

CORREO = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
TIEMPO_MINIMO_MS = 3000  # una persona no rellena el formulario en menos de 3 s
LIMITE_POR_HORA = 3
IDIOMAS = {"es", "en"}


def limpiar(datos):
    """Los campos, como texto y sin espacios de sobra (lo que no sea texto, vacío)."""
    def texto(clave):
        valor = datos.get(clave)
        return valor.strip() if isinstance(valor, str) else ""

    return {
        "nombre": texto("nombre"),
        "correo": texto("correo"),
        "asunto": texto("asunto"),
        "mensaje": texto("mensaje"),
        "idioma": texto("idioma"),
    }


def validar(campos):
    """Los errores por campo, con un código que la web traduce. Vacío si todo está bien."""
    errores = {}
    if not 2 <= len(campos["nombre"]) <= 100:
        errores["nombre"] = "nombre"
    if len(campos["correo"]) > 254 or not CORREO.match(campos["correo"]):
        errores["correo"] = "correo"
    if len(campos["asunto"]) > 150:
        errores["asunto"] = "asunto"
    if not 10 <= len(campos["mensaje"]) <= 5000:
        errores["mensaje"] = "mensaje"
    return errores


def es_bot(datos):
    """Las dos primeras capas: el campo trampa (invisible para una persona) y la rapidez."""
    trampa = datos.get("web")
    tiempo = datos.get("tiempo")
    return bool(trampa) or not isinstance(tiempo, int | float) or tiempo < TIEMPO_MINIMO_MS


def supera_limite(ip):
    """La tercera capa: como mucho 3 mensajes por IP y hora, contados en la base de datos."""
    if not ip:
        return False
    hace_una_hora = datetime.now(UTC) - timedelta(hours=1)
    recientes = db.session.scalar(
        select(func.count())
        .select_from(ContactMessage)
        .where(ContactMessage.ip_address == ip, ContactMessage.created_at > hace_una_hora)
    )
    return recientes >= LIMITE_POR_HORA


def guardar(campos, ip, navegador):
    mensaje = ContactMessage(
        name=campos["nombre"],
        email=campos["correo"],
        subject=campos["asunto"] or None,
        message=campos["mensaje"],
        locale=campos["idioma"] if campos["idioma"] in IDIOMAS else None,
        ip_address=ip,
        user_agent=(navegador or "")[:300] or None,
    )
    db.session.add(mensaje)
    db.session.commit()
    return mensaje.message_id


def avisar(message_id):
    """Envía el aviso de un mensaje guardado y lo marca como enviado. Nunca lanza."""
    mensaje = db.session.get(ContactMessage, message_id)
    if mensaje is None or mensaje.email_sent:
        return False
    try:
        enviar_aviso(mensaje)
    except ErrorCorreo as error:
        current_app.logger.warning(
            "Contacto %s: %s. Queda pendiente de reenvío.", message_id, error
        )
        return False
    mensaje.email_sent = True
    db.session.commit()
    return True


def avisar_en_segundo_plano(message_id):
    """Para que el visitante no espere al correo: se envía en otro hilo, con su contexto."""
    app = current_app._get_current_object()

    def tarea():
        with app.app_context():
            avisar(message_id)

    threading.Thread(target=tarea, daemon=True).start()
