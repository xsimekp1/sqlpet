"""add_feeding_task_constraints

Revision ID: 7071d9134a79
Revises: 29fe7f7dc785
Create Date: 2026-02-20 23:14:09.822639

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7071d9134a79'
down_revision: Union[str, Sequence[str], None] = '29fe7f7dc785'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add unique constraint to prevent duplicate feeding tasks
    # This ensures idempotent task generation
    op.create_index(
        'uq_feeding_task_window',
        'tasks',
        ['organization_id', 'type', 'related_entity_id',
         sa.text("(task_metadata->>'feeding_plan_id')"), 'due_at'],
        unique=True,
        postgresql_where=sa.text("type = 'feeding' AND deleted_at IS NULL")
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('uq_feeding_task_window', table_name='tasks')
