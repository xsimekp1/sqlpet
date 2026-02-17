"""Add last_walked_at to animals

Revision ID: add_last_walked_at
Revises: add_chat_messages
Create Date: 2026-02-17

"""

from alembic import op
import sqlalchemy as sa


revision = "add_last_walked_at"
down_revision = "add_chat_messages"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "animals",
        sa.Column("last_walked_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_column("animals", "last_walked_at")
