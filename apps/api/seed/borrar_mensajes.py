"""Borra los mensajes del formulario de contacto con más de 12 meses.

Uso:  pipenv run borrar-mensajes-antiguos   (desde apps/api)

Es lo que promete la página de Privacidad. En el servidor se programará para que corra
solo (INFRA), junto a reenviar-avisos.
"""

import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import delete

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from api import create_app  # noqa: E402
from api.extensions import db  # noqa: E402
from api.models import ContactMessage  # noqa: E402

CONSERVACION = timedelta(days=365)


def main():
    app = create_app()
    with app.app_context():
        limite = datetime.now(UTC) - CONSERVACION
        borrados = db.session.execute(
            delete(ContactMessage).where(ContactMessage.created_at < limite)
        ).rowcount
        db.session.commit()
        print(f"Mensajes de antes del {limite:%d/%m/%Y} borrados: {borrados}.")


if __name__ == "__main__":
    main()
