"""add_inventory_item_id_to_feeding_plans

Revision ID: 9d0e1f2a3b4c
Revises: f18870d8d23a
Create Date: 2026-02-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '9d0e1f2a3b4c'
down_revision: Union[str, Sequence[str], None] = 'f18870d8d23a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add inventory_item_id FK to feeding_plans."""
    op.add_column(
        'feeding_plans',
        sa.Column(
            'inventory_item_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('inventory_items.id', ondelete='SET NULL'),
            nullable=True,
        ),
    )


def downgrade() -> None:
    """Remove inventory_item_id from feeding_plans."""
    op.drop_column('feeding_plans', 'inventory_item_id')
