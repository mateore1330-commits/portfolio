"""Preparación de los tests de la API.

Usan una base de datos aparte, que se crea vacía al empezar y se vacía antes de cada test.
Nunca la tuya: su nombre tiene que terminar en _test o los tests no arrancan.

- En local: la de tu .env con "_test" al final (portfolio → portfolio_test). Hay que
  crearla una vez:  createdb -O portfolio portfolio_test
- En la CI: TEST_DATABASE_URL.

Uso:  pipenv run test   (desde apps/api)
"""

import os
import re
import sys
from pathlib import Path

import bcrypt
import pytest
from dotenv import dotenv_values

API = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(API / "src"))
sys.path.insert(0, str(API / "seed"))

CORREO = "admin@ejemplo.test"
CONTRASENA = "una-contrasena-de-prueba"


def _url_de_pruebas():
    url = os.getenv("TEST_DATABASE_URL")
    if not url:
        base = dotenv_values(API / ".env").get("DATABASE_URL", "")
        url = re.sub(r"/(\w+)(\?.*)?$", lambda m: f"/{m.group(1)}_test{m.group(2) or ''}", base)
    nombre = url.rsplit("/", 1)[-1].split("?")[0]
    if not nombre.endswith("_test"):
        pytest.exit(f"La base de los tests tiene que terminar en _test (es '{nombre}').", 2)
    return url


# Antes de crear la aplicación: create_app() lee el entorno (y el .env no pisa lo que ya hay).
os.environ["DATABASE_URL"] = _url_de_pruebas()
os.environ.setdefault("SECRET_KEY", "clave-solo-para-los-tests")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")


@pytest.fixture(scope="session")
def app():
    from api import create_app
    from api.extensions import db

    aplicacion = create_app()
    aplicacion.config["TESTING"] = True
    with aplicacion.app_context():
        # Segundo seguro, justo antes de vaciar: la base a la que está conectada DE VERDAD.
        # (El 01/11/2026, `pipenv run` cargó el .env y su DATABASE_URL pisó la de pruebas en
        # un script a mano: se vació la base local. Aquí no puede pasar.)
        conectada = db.engine.url.database or ""
        if not conectada.endswith("_test"):
            pytest.exit(f"Los tests iban a vaciar '{conectada}', que no es de pruebas. Parado.", 2)
        db.drop_all()
        db.create_all()
    yield aplicacion
    with aplicacion.app_context():
        db.drop_all()


@pytest.fixture(autouse=True)
def base_limpia(app):
    """Cada test empieza con la base vacía. En este orden: primero lo que apunta a otras tablas."""
    from api import models as m
    from api.extensions import db

    with app.app_context():
        for modelo in (m.Snapshot, m.AuthAttempt, m.AdminUser, m.ContactMessage, m.Project,
                       m.Technology, m.Job, m.Education):
            db.session.query(modelo).delete()
        db.session.commit()
    yield


@pytest.fixture
def admin(app):
    """Un administrador de prueba. Coste 4 en bcrypt: en los tests no importa la lentitud."""
    from api.extensions import db
    from api.models import AdminUser

    with app.app_context():
        hash_ = bcrypt.hashpw(CONTRASENA.encode(), bcrypt.gensalt(rounds=4)).decode("ascii")
        db.session.add(AdminUser(email=CORREO, password_hash=hash_))
        db.session.commit()
    return {"correo": CORREO, "contrasena": CONTRASENA}


@pytest.fixture
def cliente(app):
    return app.test_client()
