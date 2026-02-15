"""Add user_keyboard_shortcuts table

Revision ID: add_user_shortcuts
Revises: remove_animal_intake_date
Create Date: 2026-02-15

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "add_user_shortcuts"
down_revision = "remove_animal_intake_date"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "user_keyboard_shortcuts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("key_combo", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint("user_id", "action", name="uq_user_shortcut_action"),
    )
    op.create_index("ix_user_shortcuts_user_id", "user_keyboard_shortcuts", ["user_id"])


def downgrade():
    op.drop_index("ix_user_shortcuts_user_id", table_name="user_keyboard_shortcuts")
    op.drop_table("user_keyboard_shortcuts")
