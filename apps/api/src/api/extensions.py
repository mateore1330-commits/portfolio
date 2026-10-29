from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy

# Viven aquí y no en __init__.py para que los modelos puedan importar `db`
# sin crear una importación circular con create_app().
db = SQLAlchemy()
migrate = Migrate()
