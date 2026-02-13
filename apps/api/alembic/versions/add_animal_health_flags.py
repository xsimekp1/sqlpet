"""Add is_dewormed and is_aggressive to animals

Revision ID: add_animal_health_flags
Revises: add_color_i18n
Create Date: 2026-02-13

"""

from alembic import op
import sqlalchemy as sa

revision = "add_animal_health_flags"
down_revision = "add_color_i18n"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "animals",
        sa.Column("is_dewormed", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "animals",
        sa.Column("is_aggressive", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade():
    op.drop_column("animals", "is_aggressive")
    op.drop_column("animals", "is_dewormed")
