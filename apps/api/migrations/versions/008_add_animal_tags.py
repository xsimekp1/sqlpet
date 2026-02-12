"""add animal tags

Revision ID: 008_add_animal_tags
Revises: 007_add_inventory_feeding
Create Date: 2026-02-12

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '008_add_animal_tags'
down_revision = '007_add_inventory_feeding'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create tags table
    op.create_table(
        'tags',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('uuid_generate_v4()'), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('color', sa.String(length=20), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('organization_id', 'name', name='uq_tags_org_name')
    )
    op.create_index('ix_tags_organization_id', 'tags', ['organization_id'])

    # Create animal_tags junction table
    op.create_table(
        'animal_tags',
        sa.Column('animal_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tag_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['animal_id'], ['animals.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tag_id'], ['tags.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('animal_id', 'tag_id')
    )
    op.create_index('ix_animal_tags_animal_id', 'animal_tags', ['animal_id'])
    op.create_index('ix_animal_tags_tag_id', 'animal_tags', ['tag_id'])


def downgrade() -> None:
    op.drop_index('ix_animal_tags_tag_id', table_name='animal_tags')
    op.drop_index('ix_animal_tags_animal_id', table_name='animal_tags')
    op.drop_table('animal_tags')

    op.drop_index('ix_tags_organization_id', table_name='tags')
    op.drop_table('tags')
