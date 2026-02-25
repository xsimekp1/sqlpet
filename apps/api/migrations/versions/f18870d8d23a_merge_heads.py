"""merge_heads

Revision ID: f18870d8d23a
Revises: 4805feb71120, create_leads_table
Create Date: 2026-02-25 17:05:13.394403

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f18870d8d23a'
down_revision: Union[str, Sequence[str], None] = ('4805feb71120', 'create_leads_table')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
