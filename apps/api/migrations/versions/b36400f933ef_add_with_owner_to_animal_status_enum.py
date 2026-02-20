"""add_with_owner_to_animal_status_enum

Revision ID: b36400f933ef
Revises: 845d0e8ad167
Create Date: 2026-02-20 16:34:26.349314

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b36400f933ef"
down_revision: Union[str, Sequence[str], None] = "845d0e8ad167"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - idempotent: only add if not exists."""
    # Check if 'with_owner' exists, add if not
    result = op.execute(
        "SELECT 1 FROM pg_enum WHERE enumlabel = 'with_owner' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'animal_status_enum')"
    ).fetchone()
    if not result:
        op.execute("ALTER TYPE animal_status_enum ADD VALUE 'with_owner'")

    # Check if 'lost' exists, add if not
    result = op.execute(
        "SELECT 1 FROM pg_enum WHERE enumlabel = 'lost' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'animal_status_enum')"
    ).fetchone()
    if not result:
        op.execute("ALTER TYPE animal_status_enum ADD VALUE 'lost'")


def downgrade() -> None:
    """Downgrade schema."""
    pass
