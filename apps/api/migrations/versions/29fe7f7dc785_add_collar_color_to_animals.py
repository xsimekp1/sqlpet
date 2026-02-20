"""add_collar_color_to_animals

Revision ID: 29fe7f7dc785
Revises: 982a29ddfba8
Create Date: 2026-02-20 21:48:47.976877

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '29fe7f7dc785'
down_revision: Union[str, Sequence[str], None] = '982a29ddfba8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add collar color support for litter identification."""
    # Add collar_color column (red, blue, green, yellow, orange, purple, pink, brown)
    op.add_column('animals', sa.Column('collar_color', sa.String(length=20), nullable=True))

    # Add collar_removed_at timestamp (when collar was removed)
    op.add_column('animals', sa.Column('collar_removed_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    """Remove collar color support."""
    op.drop_column('animals', 'collar_removed_at')
    op.drop_column('animals', 'collar_color')
