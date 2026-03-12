"""merge_package_weight_and_profile_photo

Revision ID: 5e8ada7ee656
Revises: d08b274da800, f55e241d5d4a
Create Date: 2026-03-12 23:24:54.957824

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5e8ada7ee656'
down_revision: Union[str, Sequence[str], None] = ('d08b274da800', 'f55e241d5d4a')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
