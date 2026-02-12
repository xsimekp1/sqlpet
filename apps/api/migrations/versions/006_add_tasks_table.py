"""Add tasks table for task management

Revision ID: 006_add_tasks_table
Revises: 533a94311006
Create Date: 2026-02-12 00:50:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "006_add_tasks_table"
down_revision = "533a94311006"
branch_labels = None
depends_on = None


def upgrade():
    """Create tasks table with feeding integration support."""
    op.create_table(
        'tasks',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=False),
        sa.Column('created_by_id', sa.UUID(), nullable=False),
        sa.Column('assigned_to_id', sa.UUID(), nullable=True),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('type', sa.Enum('general', 'feeding', 'medical', 'cleaning', 'maintenance', 'administrative', name='task_type_enum', native_enum=False), nullable=False, server_default='general'),
        sa.Column('priority', sa.Enum('low', 'medium', 'high', 'urgent', name='task_priority_enum', native_enum=False), nullable=False, server_default='medium'),
        sa.Column('status', sa.Enum('pending', 'in_progress', 'completed', 'cancelled', name='task_status_enum', native_enum=False), nullable=False, server_default='pending'),
        sa.Column('due_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('task_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('related_entity_type', sa.String(length=50), nullable=True),
        sa.Column('related_entity_id', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['assigned_to_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes
    op.create_index('ix_tasks_organization_id', 'tasks', ['organization_id'], unique=False)
    op.create_index('ix_tasks_created_by_id', 'tasks', ['created_by_id'], unique=False)
    op.create_index('ix_tasks_assigned_to_id', 'tasks', ['assigned_to_id'], unique=False)
    op.create_index('ix_tasks_status', 'tasks', ['status'], unique=False)
    op.create_index('ix_tasks_type', 'tasks', ['type'], unique=False)
    op.create_index('ix_tasks_related_entity', 'tasks', ['related_entity_type', 'related_entity_id'], unique=False)
    op.create_index('ix_tasks_org_deleted_created', 'tasks', ['organization_id', 'deleted_at', 'created_at'], unique=False)
    op.create_index('ix_tasks_due_at', 'tasks', ['due_at'], unique=False)


def downgrade():
    """Drop tasks table and related indexes."""
    op.drop_index('ix_tasks_due_at', table_name='tasks')
    op.drop_index('ix_tasks_org_deleted_created', table_name='tasks')
    op.drop_index('ix_tasks_related_entity', table_name='tasks')
    op.drop_index('ix_tasks_type', table_name='tasks')
    op.drop_index('ix_tasks_status', table_name='tasks')
    op.drop_index('ix_tasks_assigned_to_id', table_name='tasks')
    op.drop_index('ix_tasks_created_by_id', table_name='tasks')
    op.drop_index('ix_tasks_organization_id', table_name='tasks')
    op.drop_table('tasks')
