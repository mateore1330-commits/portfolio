from flask import Flask
from flask_cors import CORS

from .admin import iniciar as iniciar_panel
from .config import load_config
from .extensions import db, migrate
from .routes import api

__version__ = "0.1.0"


def create_app():
    app = Flask(__name__)
    app.config.update(load_config(), VERSION=__version__)

    db.init_app(app)
    migrate.init_app(app, db)
    # Registra las tablas en db.metadata, que es donde Alembic las busca.
    from . import models  # noqa: F401
    # expose_headers: sin él, el navegador oculta el ETag al JavaScript de la web.
    # max_age: la comprobación previa (OPTIONS) que provoca If-None-Match se recuerda un día.
    # El panel (/api/admin/*) necesita credenciales: el navegador envía la cookie de la
    # sesión solo si la API lo permite expresamente, y solo a los orígenes de la lista.
    CORS(app, resources={
        r"/api/admin/*": {
            "origins": app.config["CORS_ORIGINS"],
            "supports_credentials": True,
            "allow_headers": ["Content-Type", "X-CSRF-TOKEN"],
            "max_age": 86400,
        },
        r"/api/*": {
            "origins": app.config["CORS_ORIGINS"],
            "expose_headers": ["ETag"],
            "max_age": 86400,
        },
    })

    app.register_blueprint(api)
    iniciar_panel(app)
    return app
