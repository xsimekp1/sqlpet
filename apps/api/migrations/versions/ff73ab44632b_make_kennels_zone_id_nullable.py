"""make_kennels_zone_id_nullable

Revision ID: ff73ab44632b
Revises: eeea0fcd3715
Create Date: 2026-03-13 16:27:30.648512

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ff73ab44632b'
down_revision: Union[str, Sequence[str], None] = 'eeea0fcd3715'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Make zone_id nullable
    op.alter_column(
        'kennels',
        'zone_id',
        existing_type=sa.UUID(),
        nullable=True,
    )
    # Change ON DELETE from CASCADE to SET NULL
    op.drop_constraint('kennels_zone_id_fkey', 'kennels', type_='foreignkey')
    op.create_foreign_key(
        'kennels_zone_id_fkey',
        'kennels',
        'zones',
        ['zone_id'],
        ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    """Downgrade schema."""
    # Revert ON DELETE to CASCADE
    op.drop_constraint('kennels_zone_id_fkey', 'kennels', type_='foreignkey')
    op.create_foreign_key(
        'kennels_zone_id_fkey',
        'kennels',
        'zones',
        ['zone_id'],
        ['id'],
        ondelete='CASCADE',
    )
    # Make zone_id NOT NULL again (will fail if any NULL values exist)
    op.alter_column(
        'kennels',
        'zone_id',
        existing_type=sa.UUID(),
        nullable=False,
    )
