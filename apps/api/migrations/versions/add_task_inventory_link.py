"""Add linked_inventory_item_id to tasks

Revision ID: add_task_inventory_link
Revises: add_intakes
Create Date: 2026-02-15

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "add_task_inventory_link"
down_revision = "add_intakes"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "tasks",
        sa.Column(
            "linked_inventory_item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("inventory_items.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_tasks_linked_inventory_item",
        "tasks",
        ["linked_inventory_item_id"],
    )


def downgrade():
    op.drop_index("ix_tasks_linked_inventory_item", table_name="tasks")
    op.drop_column("tasks", "linked_inventory_item_id")
