"""add_hotel_and_with_owner_to_animal_status_enum

Revision ID: add_hotel_with_owner
Revises: bc63efe8831c
Create Date: 2026-02-16 10:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "add_hotel_with_owner"
down_revision: Union[str, Sequence[str], None] = "add_intake_outcome_dates"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add 'hotel' and 'with_owner' values to animal_status_enum."""
    op.execute("ALTER TYPE animal_status_enum ADD VALUE IF NOT EXISTS 'hotel'")
    op.execute("ALTER TYPE animal_status_enum ADD VALUE IF NOT EXISTS 'with_owner'")


def downgrade() -> None:
    # Enum values cannot be removed in PostgreSQL without recreating the type
    pass
