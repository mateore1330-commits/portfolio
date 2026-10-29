from flask import Flask
from flask_cors import CORS

from .config import load_config
from .extensions import db, migrate
from .routes import api

__version__ = "0.1.0"


def create_app():
    app = Flask(__name__)
    app.config.update(load_config(), VERSION=__version__)

    db.init_app(app)
    migrate.init_app(app, db)
    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}})

    app.register_blueprint(api)
    return app
