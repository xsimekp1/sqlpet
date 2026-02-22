"""add_note_to_inventory_transactions

Revision ID: 505e4d0a7ae8
Revises: 6ce29aa863f5
Create Date: 2026-02-22 00:56:45.321188

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '505e4d0a7ae8'
down_revision: Union[str, Sequence[str], None] = '6ce29aa863f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add note column to inventory_transactions table."""
    op.add_column(
        'inventory_transactions',
        sa.Column('note', sa.Text(), nullable=True),
    )


def downgrade() -> None:
    """Remove note column from inventory_transactions table."""
    op.drop_column('inventory_transactions', 'note')
