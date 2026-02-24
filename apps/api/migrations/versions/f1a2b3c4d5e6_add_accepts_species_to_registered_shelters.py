"""add_accepts_species_to_registered_shelters

Revision ID: f1a2b3c4d5e6
Revises: 428ccd620610
Create Date: 2026-02-24 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = '428ccd620610'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('registered_shelters',
        sa.Column('accepts_dogs', sa.Boolean(), nullable=True))
    op.add_column('registered_shelters',
        sa.Column('accepts_cats', sa.Boolean(), nullable=True))

    # Data migration: parse existing capacity text field
    op.execute("""
        UPDATE registered_shelters
        SET
            accepts_dogs = (capacity ILIKE '%pes%'),
            accepts_cats = (capacity ILIKE '%ko%ka%')
        WHERE capacity IS NOT NULL AND capacity != ''
    """)


def downgrade() -> None:
    op.drop_column('registered_shelters', 'accepts_dogs')
    op.drop_column('registered_shelters', 'accepts_cats')
