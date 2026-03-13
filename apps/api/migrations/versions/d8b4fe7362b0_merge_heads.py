"""merge_heads

Revision ID: d8b4fe7362b0
Revises: f420bb74450f, be6d3200e70a
Create Date: 2026-03-13 10:05:13.726044

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd8b4fe7362b0'
down_revision: Union[str, Sequence[str], None] = ('f420bb74450f', 'be6d3200e70a')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
