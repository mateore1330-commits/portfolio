import os

from dotenv import load_dotenv

REQUIRED = ("SECRET_KEY", "DATABASE_URL", "CORS_ORIGINS")


class ConfigError(RuntimeError):
    """Falta alguna variable de entorno obligatoria."""


def load_config():
    """Lee la configuración del entorno y falla si falta algo obligatorio."""
    load_dotenv()

    # Una variable vacía cuenta como que falta: es lo que pasa al copiar
    # .env.example y olvidarse de rellenar una.
    missing = [name for name in REQUIRED if not os.getenv(name, "").strip()]
    if missing:
        raise ConfigError(
            "Faltan variables de entorno obligatorias: "
            f"{', '.join(missing)}.\n"
            "Cópialas de .env.example a .env y rellénalas."
        )

    return {
        "SECRET_KEY": os.environ["SECRET_KEY"],
        "SQLALCHEMY_DATABASE_URI": os.environ["DATABASE_URL"],
        "CORS_ORIGINS": [
            origin.strip()
            for origin in os.environ["CORS_ORIGINS"].split(",")
            if origin.strip()
        ],
    }
