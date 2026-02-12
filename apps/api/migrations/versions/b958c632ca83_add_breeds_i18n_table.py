"""add_breeds_i18n_table

Revision ID: b958c632ca83
Revises: 1ca0031b3012
Create Date: 2026-02-12 21:41:26.570959

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b958c632ca83'
down_revision: Union[str, Sequence[str], None] = '1ca0031b3012'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create breeds_i18n table for translatable breed names
    op.create_table(
        'breeds_i18n',
        sa.Column('breed_id', sa.UUID(), nullable=False),
        sa.Column('locale', sa.String(length=5), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['breed_id'], ['breeds.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('breed_id', 'locale'),
    )
    op.create_index(op.f('ix_breeds_i18n_breed_id'), 'breeds_i18n', ['breed_id'], unique=False)
    op.create_index(op.f('ix_breeds_i18n_locale'), 'breeds_i18n', ['locale'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_breeds_i18n_locale'), table_name='breeds_i18n')
    op.drop_index(op.f('ix_breeds_i18n_breed_id'), table_name='breeds_i18n')
    op.drop_table('breeds_i18n')
