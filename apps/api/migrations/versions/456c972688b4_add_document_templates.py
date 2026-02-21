"""add_document_templates

Revision ID: 456c972688b4
Revises: 7071d9134a79
Create Date: 2026-02-21 00:52:12.650113

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '456c972688b4'
down_revision: Union[str, Sequence[str], None] = '7071d9134a79'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create document_status enum using raw SQL to avoid SQLAlchemy auto-creation issues
    op.execute("DROP TYPE IF EXISTS document_status_enum CASCADE")
    op.execute("CREATE TYPE document_status_enum AS ENUM ('draft', 'final')")

    # Create document_templates table
    op.create_table(
        'document_templates',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('code', sa.String(64), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('language', sa.String(5), nullable=False, server_default='cs'),
        sa.Column('content_html', sa.Text(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('created_by_user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id']),
    )
    op.create_index('ix_document_templates_organization_id', 'document_templates', ['organization_id'])
    op.create_index('ix_document_templates_code', 'document_templates', ['code'])

    # Create document_instances table (without status column to avoid enum auto-creation)
    op.create_table(
        'document_instances',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('animal_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('template_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_by_user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('manual_fields', postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column('rendered_html', sa.Text(), nullable=True),
        sa.Column('pdf_storage_path', sa.String(512), nullable=True),
        sa.Column('pdf_url', sa.String(512), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['animal_id'], ['animals.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['template_id'], ['document_templates.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id']),
    )
    op.create_index('ix_document_instances_organization_id', 'document_instances', ['organization_id'])
    op.create_index('ix_document_instances_animal_id', 'document_instances', ['animal_id'])

    # Add status column with enum type using raw SQL (bypasses SQLAlchemy enum creation)
    op.execute("""
        ALTER TABLE document_instances
        ADD COLUMN status document_status_enum NOT NULL DEFAULT 'final'
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_document_instances_animal_id', table_name='document_instances')
    op.drop_index('ix_document_instances_organization_id', table_name='document_instances')
    op.drop_table('document_instances')

    op.drop_index('ix_document_templates_code', table_name='document_templates')
    op.drop_index('ix_document_templates_organization_id', table_name='document_templates')
    op.drop_table('document_templates')

    # Drop enum using raw SQL
    op.execute("DROP TYPE IF EXISTS document_status_enum")
