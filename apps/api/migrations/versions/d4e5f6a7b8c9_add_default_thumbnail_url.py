"""add_default_thumbnail_url

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-02-22 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('default_animal_images', sa.Column('thumbnail_url', sa.Text(), nullable=True))
    op.add_column('animals', sa.Column('default_thumbnail_url', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('animals', 'default_thumbnail_url')
    op.drop_column('default_animal_images', 'thumbnail_url')
