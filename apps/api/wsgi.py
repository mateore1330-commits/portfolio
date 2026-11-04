"""Punto de entrada para `flask --app wsgi run` y `gunicorn wsgi:app`."""
import sys
from pathlib import Path

# src/ no es un paquete instalado: se añade a la ruta para importar `api`.
sys.path.insert(0, str(Path(__file__).resolve().parent / "src"))

from api import create_app  # noqa: E402
from api.config import ConfigError  # noqa: E402

try:
    app = create_app()
except ConfigError as error:
    # Sale con el mensaje y sin traza: lo único útil es saber qué falta.
    sys.exit(str(error))
