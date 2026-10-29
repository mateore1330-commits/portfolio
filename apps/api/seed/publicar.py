"""Publica: guarda una instantánea del contenido en la tabla snapshots.

Uso:  pipenv run publicar   (desde apps/api)

Es lo que hará el botón "Publicar" del panel (ADM-05). Si el contenido no ha cambiado
desde la última publicación, no crea ninguna fila nueva.
"""

import sys
from pathlib import Path

from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from api import create_app  # noqa: E402
from api.extensions import db  # noqa: E402
from api.models import AdminUser  # noqa: E402
from api.snapshot import InstantaneaError, publicar  # noqa: E402


def main():
    with create_app().app_context():
        admin = db.session.scalar(select(AdminUser))
        if admin is None:
            sys.exit("No hay administrador: cada publicación necesita un autor. "
                     "Créalo con la semilla (ADMIN_EMAIL y ADMIN_PASSWORD).")
        autor_id = admin.admin_id
        # publicar() tiene que empezar su propia transacción para poder leer con
        # REPEATABLE READ: se cierra la lectura del administrador antes.
        db.session.rollback()
        try:
            nueva, snapshot, tamano = publicar(autor_id)
            db.session.commit()
        except InstantaneaError as e:
            db.session.rollback()
            sys.exit(f"No se ha publicado. {e}")

        p = snapshot.payload
        resumen = (f"{len(p['projects'])} proyectos · {len(p['technologies'])} tecnologías · "
                   f"{len(p['jobs'])} empleos · {len(p['education'])} formaciones · "
                   f"{tamano / 1024:.1f} KB")
        if nueva:
            print(f"Publicado (instantánea {snapshot.snapshot_id}): {resumen}")
        else:
            print(f"El contenido no ha cambiado: sigue vigente la instantánea "
                  f"{snapshot.snapshot_id} ({resumen}).")
        print(f"ETag: {snapshot.etag[:16]}…")


if __name__ == "__main__":
    main()
