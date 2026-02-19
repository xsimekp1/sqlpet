"""add_notes_to_registered_shelters

Revision ID: 148e97522a3b
Revises: 20260219_own_food_hotel
Create Date: 2026-02-19 22:21:19.655092

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '148e97522a3b'
down_revision: Union[str, Sequence[str], None] = '20260219_own_food_hotel'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add notes column to registered_shelters table."""
    op.add_column('registered_shelters', sa.Column('notes', sa.Text(), nullable=True))


def downgrade() -> None:
    """Remove notes column from registered_shelters table."""
    op.drop_column('registered_shelters', 'notes')
