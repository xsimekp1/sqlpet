"""add_website_publication_fields

Revision ID: 4fa91caff4fd
Revises: 2a7660df58b4
Create Date: 2026-02-21 09:06:45.958030

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '4fa91caff4fd'
down_revision: Union[str, Sequence[str], None] = '2a7660df58b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add website publication tracking fields to animals."""
    # Add website_published_at (when found animal was published to website)
    op.add_column(
        "animals", sa.Column("website_published_at", sa.Date(), nullable=True)
    )

    # Add website_deadline_at (computed: published_at + 4 months)
    op.add_column("animals", sa.Column("website_deadline_at", sa.Date(), nullable=True))

    # Add website_published_by_user_id (who published it)
    op.add_column(
        "animals",
        sa.Column(
            "website_published_by_user_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )

    # Add foreign key constraint
    op.create_foreign_key(
        "animals_website_published_by_user_id_fkey",
        "animals",
        "users",
        ["website_published_by_user_id"],
        ["id"],
    )


def downgrade() -> None:
    """Remove website publication tracking fields."""
    # Drop foreign key first
    op.drop_constraint(
        "animals_website_published_by_user_id_fkey", "animals", type_="foreignkey"
    )

    # Drop columns
    op.drop_column("animals", "website_published_by_user_id")
    op.drop_column("animals", "website_deadline_at")
    op.drop_column("animals", "website_published_at")
