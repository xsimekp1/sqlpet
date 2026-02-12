"""merge duplicate migration branches

Revision ID: cdacab9461ba
Revises: 005_add_inventory_feeding, 008_add_animal_tags
Create Date: 2026-02-12 08:41:49.258720

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cdacab9461ba'
down_revision: Union[str, Sequence[str], None] = ('005_add_inventory_feeding', '008_add_animal_tags')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
