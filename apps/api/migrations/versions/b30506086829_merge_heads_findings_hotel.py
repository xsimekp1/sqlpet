"""merge_heads_findings_hotel

Revision ID: b30506086829
Revises: 9409224bccf4, add_hotel_with_owner
Create Date: 2026-02-16 18:45:24.018336

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b30506086829'
down_revision: Union[str, Sequence[str], None] = ('9409224bccf4', 'add_hotel_with_owner')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
