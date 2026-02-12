"""add weight ranges to breeds table

Revision ID: e76d461ff0e5
Revises: b958c632ca83
Create Date: 2026-02-12 22:47:50.400325

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e76d461ff0e5'
down_revision: Union[str, Sequence[str], None] = 'b958c632ca83'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add weight range columns to breeds table (all in kg)
    op.add_column('breeds', sa.Column('weight_male_min', sa.Numeric(precision=6, scale=2), nullable=True))
    op.add_column('breeds', sa.Column('weight_male_max', sa.Numeric(precision=6, scale=2), nullable=True))
    op.add_column('breeds', sa.Column('weight_female_min', sa.Numeric(precision=6, scale=2), nullable=True))
    op.add_column('breeds', sa.Column('weight_female_max', sa.Numeric(precision=6, scale=2), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove weight range columns
    op.drop_column('breeds', 'weight_female_max')
    op.drop_column('breeds', 'weight_female_min')
    op.drop_column('breeds', 'weight_male_max')
    op.drop_column('breeds', 'weight_male_min')
