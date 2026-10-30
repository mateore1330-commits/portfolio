"""tipo, horas y certificado de la formacion

Revision ID: 798ca90d88df
Revises: e79bd255c950
Create Date: 2026-10-30 19:29:16.340665

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '798ca90d88df'
down_revision = 'e79bd255c950'
branch_labels = None
depends_on = None

# create_type=False: el tipo se crea y se borra a mano, abajo. Si no, al subir no se
# crearía (add_column no lo hace) y al bajar se quedaría en la base de datos.
education_kind = postgresql.ENUM('program', 'course', name='education_kind', create_type=False)


def upgrade():
    education_kind.create(op.get_bind(), checkfirst=True)
    # server_default 'program': las filas que ya hay pasan a ser "formación" sin tocarlas.
    with op.batch_alter_table('education', schema=None) as batch_op:
        batch_op.add_column(sa.Column('kind', education_kind, server_default='program', nullable=False))
        batch_op.add_column(sa.Column('hours', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('certificate_url', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('certificate_file', sa.String(), nullable=True))
        # Alembic no detecta los CHECK: escrito a mano.
        batch_op.create_check_constraint('horas_positivas', 'hours > 0')


def downgrade():
    with op.batch_alter_table('education', schema=None) as batch_op:
        batch_op.drop_constraint('horas_positivas', type_='check')
        batch_op.drop_column('certificate_file')
        batch_op.drop_column('certificate_url')
        batch_op.drop_column('hours')
        batch_op.drop_column('kind')
    # Alembic no borra los tipos ENUM al bajar.
    education_kind.drop(op.get_bind(), checkfirst=True)
