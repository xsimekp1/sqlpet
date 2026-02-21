"""add_waiting_adoption_status

Revision ID: 2a7660df58b4
Revises: 456c972688b4
Create Date: 2026-02-21 09:06:09.801192

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2a7660df58b4'
down_revision: Union[str, Sequence[str], None] = '456c972688b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - idempotent: only add if not exists."""
    conn = op.get_bind()

    # Check if 'waiting_adoption' exists, add if not
    result = conn.execute(
        sa.text(
            "SELECT 1 FROM pg_enum WHERE enumlabel = 'waiting_adoption' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'animal_status_enum')"
        )
    ).fetchone()
    if not result:
        conn.execute(
            sa.text("ALTER TYPE animal_status_enum ADD VALUE 'waiting_adoption'")
        )


def downgrade() -> None:
    """Downgrade schema."""
    # PostgreSQL doesn't support removing enum values
    # This is acceptable for status enums
    pass
