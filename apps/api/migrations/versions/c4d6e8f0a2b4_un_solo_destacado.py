"""un solo destacado: el primer proyecto publicado, y va el primero (#154)

Solo datos: no cambia tablas. Deja la regla que aplica la API (proyectos.un_destacado)
cumplida desde el principio, aunque antes hubiera varios destacados o ninguno.

Revision ID: c4d6e8f0a2b4
Revises: b3a5c7d9e1f2
Create Date: 2026-11-02 21:00:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c4d6e8f0a2b4'
down_revision = 'b3a5c7d9e1f2'
branch_labels = None
depends_on = None


def upgrade():
    conexion = op.get_bind()
    filas = conexion.execute(sa.text(
        "SELECT project_id, status FROM projects ORDER BY sort_order, slug"
    )).all()
    destacado = next((ident for ident, estado in filas if estado == 'published'), None)
    orden = [ident for ident, _ in filas]
    if destacado is not None:
        orden.remove(destacado)
        orden.insert(0, destacado)
    for i, ident in enumerate(orden):
        conexion.execute(
            sa.text("UPDATE projects SET sort_order = :i, is_featured = :d WHERE project_id = :p"),
            {"i": i, "d": ident == destacado, "p": ident},
        )


def downgrade():
    # Nada que deshacer: las tablas son las mismas y los datos de antes ya cumplían la regla
    # o tenían varios destacados, que no se pueden recuperar.
    pass
