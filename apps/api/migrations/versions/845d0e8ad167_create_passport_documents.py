"""create_passport_documents

Revision ID: 845d0e8ad167
Revises: d2611dcf3dc0
Create Date: 2026-02-20 14:25:25.213287

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '845d0e8ad167'
down_revision: Union[str, Sequence[str], None] = 'd2611dcf3dc0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'animal_passport_documents',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('passport_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('file_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('document_type', sa.String(length=20), server_default='scan', nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("document_type IN ('scan', 'photo')", name='check_document_type'),
        sa.ForeignKeyConstraint(['passport_id'], ['animal_passports.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['file_id'], ['files.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_passport_documents_passport', 'animal_passport_documents', ['passport_id'])
    op.create_index('idx_passport_documents_file', 'animal_passport_documents', ['file_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('idx_passport_documents_file', table_name='animal_passport_documents')
    op.drop_index('idx_passport_documents_passport', table_name='animal_passport_documents')
    op.drop_table('animal_passport_documents')
