"""create_animal_passports

Revision ID: d2611dcf3dc0
Revises: 488c36e199f1
Create Date: 2026-02-20 14:24:56.825260

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'd2611dcf3dc0'
down_revision: Union[str, Sequence[str], None] = '488c36e199f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'animal_passports',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('animal_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('passport_number', sa.String(length=64), nullable=True),
        sa.Column('issued_at', sa.Date(), nullable=True),
        sa.Column('issuer_name', sa.String(length=128), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['animal_id'], ['animals.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('animal_id')
    )
    op.create_index('idx_animal_passports_animal', 'animal_passports', ['animal_id'])
    op.create_index('idx_animal_passports_org', 'animal_passports', ['organization_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_animal_passports_org', table_name='animal_passports')
    op.drop_index('idx_animal_passports_animal', table_name='animal_passports')
    op.drop_table('animal_passports')
