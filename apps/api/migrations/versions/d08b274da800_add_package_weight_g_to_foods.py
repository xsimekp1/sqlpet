"""add_package_weight_g_to_foods

Revision ID: d08b274da800
Revises: f8a9b0c1d2e3
Create Date: 2026-03-12 01:04:22.966594

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd08b274da800'
down_revision: Union[str, Sequence[str], None] = 'f8a9b0c1d2e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('foods', sa.Column('package_weight_g', sa.Numeric(precision=8, scale=2), nullable=True))


def downgrade() -> None:
    op.drop_column('foods', 'package_weight_g')
