"""Add is_pregnant to animals

Revision ID: add_is_pregnant
Revises: add_contacts
Create Date: 2026-02-13

"""

from alembic import op
import sqlalchemy as sa

revision = "add_is_pregnant"
down_revision = "add_contacts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "animals",
        sa.Column(
            "is_pregnant",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )


def downgrade() -> None:
    op.drop_column("animals", "is_pregnant")
