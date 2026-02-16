"""add_registered_to_animal_status_enum

Revision ID: bc63efe8831c
Revises: merge_two_heads
Create Date: 2026-02-16 02:04:20.454860

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bc63efe8831c'
down_revision: Union[str, Sequence[str], None] = 'merge_two_heads'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add 'registered' value to animal_status_enum."""
    op.execute("ALTER TYPE animal_status_enum ADD VALUE IF NOT EXISTS 'registered'")


def downgrade() -> None:
    # Enum values cannot be removed in PostgreSQL without recreating the type
    pass
