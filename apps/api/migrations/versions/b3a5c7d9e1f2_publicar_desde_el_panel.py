"""publicar desde el panel: lo que guarda cada publicacion y los PDF del CV

Revision ID: b3a5c7d9e1f2
Revises: e8f26aae4b4a
Create Date: 2026-11-02 13:30:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = 'b3a5c7d9e1f2'
down_revision = 'e8f26aae4b4a'
branch_labels = None
depends_on = None

CV_STATUS = postgresql.ENUM('pending', 'generated', 'unchanged', 'failed', name='cv_status')
DEPLOY_STATUS = postgresql.ENUM('pending', 'deployed', 'failed', 'not_configured',
                                name='deploy_status')


def upgrade():
    CV_STATUS.create(op.get_bind(), checkfirst=False)
    DEPLOY_STATUS.create(op.get_bind(), checkfirst=False)
    with op.batch_alter_table('snapshots', schema=None) as batch_op:
        batch_op.add_column(sa.Column('changes', postgresql.JSONB(none_as_null=True), nullable=True))
        batch_op.add_column(sa.Column('size_bytes', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('cv_status', postgresql.ENUM(name='cv_status', create_type=False),
                                      server_default='pending', nullable=False))
        batch_op.add_column(sa.Column('cv_detail', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('deploy_status',
                                      postgresql.ENUM(name='deploy_status', create_type=False),
                                      server_default='pending', nullable=False))
        batch_op.add_column(sa.Column('deploy_detail', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('deployed_at', sa.DateTime(timezone=True), nullable=True))
    # Las publicaciones de antes (con `pipenv run publicar`) no generaban el CV ni desplegaban.
    op.execute("UPDATE snapshots SET cv_status = 'unchanged', deploy_status = 'not_configured'")

    op.create_table(
        'cv_pdfs',
        sa.Column('lang', sa.String(), nullable=False),
        sa.Column('is_test', sa.Boolean(), nullable=False),
        sa.Column('content', sa.LargeBinary(), nullable=False),
        sa.Column('pages', sa.Integer(), nullable=False),
        sa.Column('cv_hash', sa.String(), nullable=False),
        sa.Column('ats_problems', postgresql.JSONB(astext_type=sa.Text()),
                  server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column('generated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'),
                  nullable=False),
        sa.PrimaryKeyConstraint('lang', 'is_test', name=op.f('pk_cv_pdfs')),
    )


def downgrade():
    op.drop_table('cv_pdfs')
    with op.batch_alter_table('snapshots', schema=None) as batch_op:
        batch_op.drop_column('deployed_at')
        batch_op.drop_column('deploy_detail')
        batch_op.drop_column('deploy_status')
        batch_op.drop_column('cv_detail')
        batch_op.drop_column('cv_status')
        batch_op.drop_column('size_bytes')
        batch_op.drop_column('changes')
    DEPLOY_STATUS.drop(op.get_bind(), checkfirst=False)
    CV_STATUS.drop(op.get_bind(), checkfirst=False)
