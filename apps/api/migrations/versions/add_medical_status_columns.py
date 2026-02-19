"""Add missing medical status columns to animals

Revision ID: add_medical_status_columns
Revises: create_all_missing_tables
Create Date: 2026-02-19

"""

from alembic import op
import sqlalchemy as sa

revision = "add_medical_status_columns"
down_revision = "create_all_missing_tables"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "animals",
        sa.Column("is_lactating", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "animals",
        sa.Column("is_critical", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "animals",
        sa.Column("is_diabetic", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.add_column(
        "animals",
        sa.Column("is_cancer", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade():
    op.drop_column("animals", "is_cancer")
    op.drop_column("animals", "is_diabetic")
    op.drop_column("animals", "is_critical")
    op.drop_column("animals", "is_lactating")
