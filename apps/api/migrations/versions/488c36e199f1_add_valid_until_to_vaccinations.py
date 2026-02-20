"""add_valid_until_to_vaccinations

Revision ID: 488c36e199f1
Revises: add_legal_deadline_fields
Create Date: 2026-02-20 14:24:37.678197

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '488c36e199f1'
down_revision: Union[str, Sequence[str], None] = 'add_legal_deadline_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('animal_vaccinations', sa.Column('valid_until', sa.Date(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('animal_vaccinations', 'valid_until')
