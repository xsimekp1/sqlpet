"""make_task_created_by_nullable

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-02-22 12:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Make created_by_id nullable so system-generated tasks (e.g. feeding tasks)
    # don't require a real user FK. Also change ON DELETE behavior to SET NULL
    # so tasks survive user deletion.
    op.alter_column('tasks', 'created_by_id', nullable=True)
    # Drop old CASCADE constraint and add SET NULL
    op.drop_constraint('tasks_created_by_id_fkey', 'tasks', type_='foreignkey')
    op.create_foreign_key(
        'tasks_created_by_id_fkey',
        'tasks', 'users',
        ['created_by_id'], ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('tasks_created_by_id_fkey', 'tasks', type_='foreignkey')
    op.create_foreign_key(
        'tasks_created_by_id_fkey',
        'tasks', 'users',
        ['created_by_id'], ['id'],
        ondelete='CASCADE',
    )
    op.alter_column('tasks', 'created_by_id', nullable=False)
