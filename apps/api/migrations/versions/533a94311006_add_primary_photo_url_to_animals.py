"""add_primary_photo_url_to_animals

Revision ID: 533a94311006
Revises: c7a8f9e0d1b2
Create Date: 2026-02-11 21:13:16.539283

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '533a94311006'
down_revision: Union[str, Sequence[str], None] = 'c7a8f9e0d1b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('animals', sa.Column('primary_photo_url', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('animals', 'primary_photo_url')
