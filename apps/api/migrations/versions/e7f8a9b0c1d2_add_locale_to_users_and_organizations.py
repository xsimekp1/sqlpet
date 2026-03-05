"""add_locale_to_users_and_organizations

Revision ID: e7f8a9b0c1d2
Revises: d6e7f8a9b0c1
Create Date: 2026-03-05 20:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e7f8a9b0c1d2"
down_revision: Union[str, None] = "d6e7f8a9b0c1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("locale", sa.String(5), nullable=False, server_default="cs"),
    )
    op.add_column(
        "organizations",
        sa.Column("default_locale", sa.String(5), nullable=False, server_default="cs"),
    )


def downgrade() -> None:
    op.drop_column("users", "locale")
    op.drop_column("organizations", "default_locale")
