"""add_website_deadline_type

Revision ID: 6ce29aa863f5
Revises: 4fa91caff4fd
Create Date: 2026-02-21 10:27:36.492840

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '6ce29aa863f5'
down_revision: Union[str, Sequence[str], None] = '4fa91caff4fd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add website_deadline_type field to animals."""
    op.add_column(
        "animals",
        sa.Column("website_deadline_type", sa.String(length=20), nullable=True),
    )


def downgrade() -> None:
    """Remove website_deadline_type field."""
    op.drop_column("animals", "website_deadline_type")
