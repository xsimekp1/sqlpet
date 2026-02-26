"""add_legal_deadline_fields_to_animals

Revision ID: c5d6e7f8a9b0
Revises: b4c5d6e7f8a9
Create Date: 2026-02-26 14:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c5d6e7f8a9b0"
down_revision: Union[str, Sequence[str], None] = "b4c5d6e7f8a9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add legal deadline fields to animals table.

    These fields track legal announcement dates for found animals
    that are not physically in the shelter (staying with finder).
    """
    op.add_column(
        "animals", sa.Column("legal_notice_published_at", sa.Date(), nullable=True)
    )
    op.add_column(
        "animals",
        sa.Column("legal_finder_claims_ownership", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "animals",
        sa.Column("legal_municipality_transferred", sa.Boolean(), nullable=True),
    )


def downgrade() -> None:
    """Remove legal deadline fields from animals table."""
    op.drop_column("animals", "legal_municipality_transferred")
    op.drop_column("animals", "legal_finder_claims_ownership")
    op.drop_column("animals", "legal_notice_published_at")
