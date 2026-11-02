"""sin page_views: las visitas las cuenta Umami, en nuestro servidor (ADM-10)

La tabla nunca se llegó a usar (estaba vacía). Deshacer la vuelve a crear, vacía.

Revision ID: d5e7f9a1b3c5
Revises: c4d6e8f0a2b4
Create Date: 2026-11-02 23:30:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd5e7f9a1b3c5'
down_revision = 'c4d6e8f0a2b4'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('page_views', schema=None) as batch_op:
        batch_op.drop_index('idx_visitas_fecha')
    op.drop_table('page_views')


def downgrade():
    op.create_table(
        'page_views',
        sa.Column('view_id', sa.Integer(), nullable=False),
        sa.Column('path', sa.String(), nullable=False),
        sa.Column('locale', sa.String(), nullable=True),
        sa.Column('referrer', sa.String(), nullable=True),
        sa.Column('country', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'),
                  nullable=False),
        sa.PrimaryKeyConstraint('view_id', name=op.f('pk_page_views')),
    )
    with op.batch_alter_table('page_views', schema=None) as batch_op:
        batch_op.create_index('idx_visitas_fecha', ['created_at'], unique=False)
