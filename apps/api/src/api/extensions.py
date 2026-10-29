from datetime import datetime

from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import DateTime, MetaData
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, registry

# Nombres fijos para las restricciones: sin ellos los inventa PostgreSQL, y
# Alembic no puede borrarlas ni cambiarlas en migraciones futuras.
NAMING_CONVENTION = {
    "pk": "pk_%(table_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "ix": "ix_%(table_name)s_%(column_0_name)s",
}


class Base(DeclarativeBase):
    # Todas las fechas con zona horaria (TIMESTAMPTZ), y todo dict es JSONB.
    # none_as_null: un None de Python se guarda como NULL de SQL, no como el JSON 'null'.
    registry = registry(
        metadata=MetaData(naming_convention=NAMING_CONVENTION),
        type_annotation_map={
            datetime: DateTime(timezone=True),
            dict: JSONB(none_as_null=True),
        },
    )


# Viven aquí y no en __init__.py para que los modelos puedan importar `db`
# sin crear una importación circular con create_app().
db = SQLAlchemy(model_class=Base)
# compare_server_default: que las migraciones automáticas detecten también
# cambios en los valores por defecto, no solo en columnas y tipos.
migrate = Migrate(compare_server_default=True)
