"""ajustes de contenido

Lo que pedía el contenido real y no cabía en el esquema inicial:
- La categoría "design" en tech_category.
- projects.period pasa a JSONB: el periodo se escribe distinto en cada idioma.
- projects.label (JSONB): "Proyecto final del bootcamp · En equipo de 4".
- education.institution admite nulos: la formación por cuenta propia no tiene centro.

Escrita a mano: Alembic no detecta valores nuevos en un ENUM ni sabe cómo
convertir varchar a JSONB.

Revision ID: 782f8d7f3dce
Revises: 5f77a1c06904
Create Date: 2026-10-29 16:25:56.702027

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '782f8d7f3dce'
down_revision = '5f77a1c06904'
branch_labels = None
depends_on = None


def upgrade():
    # El valor nuevo no se puede usar dentro de esta misma transacción; aquí no se usa.
    op.execute("ALTER TYPE tech_category ADD VALUE 'design' BEFORE 'soft'")

    # Si ya hubiera periodos escritos, se conservan como la versión en español.
    op.alter_column(
        'projects', 'period',
        type_=postgresql.JSONB(astext_type=sa.Text()),
        postgresql_using="CASE WHEN period IS NULL THEN NULL ELSE jsonb_build_object('es', period) END",
    )
    op.add_column('projects', sa.Column('label', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.alter_column('education', 'institution', nullable=True)


def downgrade():
    # Falla si hay alguna formación sin centro: hay que completarla antes de bajar.
    op.alter_column('education', 'institution', nullable=False)
    op.drop_column('projects', 'label')
    # Vuelve a texto con la versión en español; la inglesa se pierde.
    op.alter_column(
        'projects', 'period',
        type_=sa.String(),
        postgresql_using="period->>'es'",
    )

    # PostgreSQL no deja quitar un valor de un ENUM: se recrea el tipo sin él.
    # Falla si alguna tecnología usa "design": hay que cambiarla antes de bajar.
    op.execute("ALTER TYPE tech_category RENAME TO tech_category_old")
    op.execute("CREATE TYPE tech_category AS ENUM ('frontend', 'backend', 'data', 'tools', 'soft')")
    op.execute(
        "ALTER TABLE technologies ALTER COLUMN category TYPE tech_category "
        "USING category::text::tech_category"
    )
    op.execute("DROP TYPE tech_category_old")
