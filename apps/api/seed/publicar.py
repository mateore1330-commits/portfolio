"""Publica desde la consola: lo mismo que el botón "Publicar" del panel (ADM-05).

Uso:  pipenv run publicar   (desde apps/api)
      python seed/publicar.py   (en el servidor, dentro del contenedor de la API: GO-03)

Los tres pasos del panel, con las mismas funciones (api/publicar.py): la instantánea, el CV en
PDF si ha cambiado y el aviso a Vercel si está configurado. Si no hay nada que publicar, no
crea nada.
"""

import sys
from pathlib import Path

from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from api import create_app  # noqa: E402
from api.extensions import db  # noqa: E402
from api.models import AdminUser, CvStatus, DeployStatus  # noqa: E402
from api.publicar import hacer_cv, hacer_despliegue, hacer_foto, pendientes  # noqa: E402

CV = {
    CvStatus.GENERATED: "generado (español e inglés)",
    CvStatus.UNCHANGED: "sin cambios",
    CvStatus.FAILED: "NO se ha publicado",
}
DESPLIEGUE = {
    DeployStatus.DEPLOYED: "Vercel avisado",
    DeployStatus.NOT_CONFIGURED: "sin Vercel configurado (no se avisa)",
    DeployStatus.FAILED: "Vercel NO ha contestado",
}


def main():
    with create_app().app_context():
        admin = db.session.scalar(select(AdminUser))
        if admin is None:
            sys.exit("No hay administrador: cada publicación necesita un autor. "
                     "Créalo con la semilla (ADMIN_EMAIL y ADMIN_PASSWORD).")
        lista = pendientes()
        if not lista:
            print("No hay nada que publicar: el contenido es el de la última publicación.")
            return

        snapshot, error = hacer_foto(admin.admin_id, lista)
        if error:
            sys.exit(f"No se ha publicado. {error}")
        p = snapshot.payload
        print(f"1. Instantánea {snapshot.snapshot_id}: {len(p['projects'])} proyectos · "
              f"{len(p['technologies'])} tecnologías · {len(p['jobs'])} empleos · "
              f"{len(p['education'])} formaciones · {snapshot.size_bytes / 1024:.1f} KB")
        print(f"   Cambios: {', '.join(lista)}")

        hacer_cv(snapshot)
        print(f"2. CV en PDF: {CV.get(snapshot.cv_status, snapshot.cv_status.value)}")
        if snapshot.cv_status is CvStatus.FAILED:
            print(f"   {snapshot.cv_detail}")

        hacer_despliegue(snapshot)
        print(f"3. Web: {DESPLIEGUE.get(snapshot.deploy_status, snapshot.deploy_status.value)}")
        if snapshot.cv_status is CvStatus.FAILED:
            sys.exit(1)


if __name__ == "__main__":
    main()
