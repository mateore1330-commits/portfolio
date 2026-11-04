"""Reenvía los avisos por correo que quedaron pendientes (email_sent = false).

Uso:  pipenv run reenviar-avisos   (desde apps/api)

Pasa si el correo no estaba configurado o falló en su momento: los mensajes se guardaron
igual. En el servidor se programará para que corra solo (INFRA).
"""

import sys
from pathlib import Path

from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from api import create_app  # noqa: E402
from api.contacto import avisar  # noqa: E402
from api.correo import configurado  # noqa: E402
from api.extensions import db  # noqa: E402
from api.models import ContactMessage  # noqa: E402


def main():
    app = create_app()
    with app.app_context():
        if not configurado():
            sys.exit(
                "El correo no está configurado: rellena SMTP_HOST, SMTP_USER y "
                "SMTP_PASSWORD en .env."
            )
        pendientes = db.session.scalars(
            select(ContactMessage.message_id)
            .where(ContactMessage.email_sent.is_(False))
            .order_by(ContactMessage.created_at)
        ).all()
        enviados = sum(avisar(message_id) for message_id in pendientes)
        print(f"Avisos pendientes: {len(pendientes)} · enviados ahora: {enviados}.")
        if enviados < len(pendientes):
            sys.exit(1)


if __name__ == "__main__":
    main()
