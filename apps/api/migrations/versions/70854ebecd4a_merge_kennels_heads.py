"""merge_kennels_heads

Revision ID: 70854ebecd4a
Revises: 004_add_kennels_zones_stays, add_kennel_map_layout
Create Date: 2026-02-11 16:31:12.378834

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '70854ebecd4a'
down_revision: Union[str, Sequence[str], None] = ('004_add_kennels_zones_stays', 'add_kennel_map_layout')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
