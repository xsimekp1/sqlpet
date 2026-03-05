"""add_enrichment_meta_to_registered_shelters

Revision ID: d6e7f8a9b0c1
Revises: c5d6e7f8a9b0
Create Date: 2026-02-26 15:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d6e7f8a9b0c1"
down_revision: Union[str, Sequence[str], None] = "c5d6e7f8a9b0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add enrichment metadata columns to registered_shelters table."""
    op.add_column(
        "registered_shelters",
        sa.Column("phone_source", sa.String(255), nullable=True),
    )
    op.add_column(
        "registered_shelters",
        sa.Column("search_confidence", sa.Float(), nullable=True),
    )
    op.add_column(
        "registered_shelters",
        sa.Column("scrape_status", sa.String(50), nullable=True),
    )
    op.add_column(
        "registered_shelters",
        sa.Column("last_checked", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    """Remove enrichment metadata columns from registered_shelters table."""
    op.drop_column("registered_shelters", "last_checked")
    op.drop_column("registered_shelters", "scrape_status")
    op.drop_column("registered_shelters", "search_confidence")
    op.drop_column("registered_shelters", "phone_source")
