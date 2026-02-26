"""merge_inventory_item_id_and_ec53abc9f8e7

Revision ID: ced22b38c572
Revises: 9d0e1f2a3b4c, ec53abc9f8e7
Create Date: 2026-02-26 01:01:17.687808

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ced22b38c572'
down_revision: Union[str, Sequence[str], None] = ('9d0e1f2a3b4c', 'ec53abc9f8e7')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
