"""Cambia la contraseña del administrador del panel (ADM-01).

Uso:  pipenv run cambiar-contrasena   (desde apps/api; en el servidor, por SSH)

- La pide dos veces sin mostrarla (getpass): no se ve al escribirla ni queda en el
  historial de la terminal.
- 12 caracteres o más y 72 bytes como mucho (el límite de bcrypt).
- La guarda con bcrypt (coste 12) y sube token_version: se cierran todas las sesiones
  abiertas, en todos los dispositivos.

Se cambia desde la terminal y no desde la web a propósito (decidido el 29/10/2026): así
hace falta acceso a la máquina, no solo la contraseña actual, y sirve también si se olvida.
"""

import sys
from getpass import getpass
from pathlib import Path

import bcrypt
from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from api import create_app  # noqa: E402
from api.extensions import db  # noqa: E402
from api.models import AdminUser  # noqa: E402

MINIMO = 12
MAXIMO_BYTES = 72  # bcrypt ignora lo que pase de aquí


class ContrasenaError(Exception):
    """La contraseña no vale. El mensaje dice por qué."""


def comprobar(nueva, repetida):
    if nueva != repetida:
        raise ContrasenaError("No coinciden.")
    if len(nueva) < MINIMO:
        raise ContrasenaError(f"Tiene que tener {MINIMO} caracteres o más.")
    if len(nueva.encode("utf-8")) > MAXIMO_BYTES:
        raise ContrasenaError(f"No puede pasar de {MAXIMO_BYTES} bytes (el límite de bcrypt).")


def cambiar_contrasena(nueva):
    """Guarda la contraseña nueva y cierra todas las sesiones. Devuelve el correo del admin."""
    admin_user = db.session.scalar(select(AdminUser))
    if admin_user is None:
        raise ContrasenaError(
            "No hay administrador. Créalo con la semilla (ADMIN_EMAIL y ADMIN_PASSWORD)."
        )
    hash_ = bcrypt.hashpw(nueva.encode("utf-8"), bcrypt.gensalt(rounds=12))
    admin_user.password_hash = hash_.decode("ascii")
    admin_user.token_version += 1
    db.session.commit()
    return admin_user.email


def main():
    with create_app().app_context():
        try:
            nueva = getpass("Contraseña nueva: ")
            comprobar(nueva, getpass("Repítela: "))
            correo = cambiar_contrasena(nueva)
        except ContrasenaError as e:
            sys.exit(f"No se ha cambiado. {e}")
        except (KeyboardInterrupt, EOFError):
            sys.exit("\nNo se ha cambiado.")
    print(f"Contraseña cambiada para {correo}. Se han cerrado todas las sesiones abiertas.")


if __name__ == "__main__":
    main()
