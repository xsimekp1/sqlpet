"""merge rabbit_to_rodent and purchase_orders branches

Revision ID: 56408710e94d
Revises: 095b487207b9, 1d675e8e5cbd
Create Date: 2026-02-20 19:34:41.204327

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '56408710e94d'
down_revision: Union[str, Sequence[str], None] = ('095b487207b9', '1d675e8e5cbd')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
