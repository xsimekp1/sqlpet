"""add_phone_website_to_registered_shelters

Revision ID: a3b4c5d6e7f8
Revises: ced22b38c572
Create Date: 2026-02-26 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3b4c5d6e7f8'
down_revision: Union[str, Sequence[str], None] = 'ced22b38c572'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add phone and website columns to registered_shelters table."""
    op.add_column('registered_shelters', sa.Column('phone', sa.String(50), nullable=True))
    op.add_column('registered_shelters', sa.Column('website', sa.String(500), nullable=True))


def downgrade() -> None:
    """Remove phone and website columns from registered_shelters table."""
    op.drop_column('registered_shelters', 'website')
    op.drop_column('registered_shelters', 'phone')
