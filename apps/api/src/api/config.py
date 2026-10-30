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
        # Opcionales: sin ellas la API arranca, pero /api/contributions no consulta GitHub
        # (sirve la copia guardada, o 503 si no hay ninguna).
        "GITHUB_TOKEN": os.getenv("GITHUB_TOKEN", "").strip(),
        "GITHUB_LOGIN": os.getenv("GITHUB_LOGIN", "").strip(),
        # Opcionales: el aviso por correo del formulario de contacto. Sin ellas, los
        # mensajes se guardan igual y quedan pendientes de reenvío.
        "SMTP_HOST": os.getenv("SMTP_HOST", "").strip(),
        "SMTP_PORT": int(os.getenv("SMTP_PORT", "465") or 465),
        "SMTP_USER": os.getenv("SMTP_USER", "").strip(),
        "SMTP_PASSWORD": os.getenv("SMTP_PASSWORD", ""),
        "CONTACT_TO": os.getenv("CONTACT_TO", "").strip(),
    }
