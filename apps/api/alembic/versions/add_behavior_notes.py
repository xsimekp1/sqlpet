"""Add behavior_notes and is_special_needs to animals

Revision ID: add_behavior_notes
Revises: add_kennel_last_cleaned
- Add behavior_notes TEXT (nullable) to animals table
- Add is_special_needs BOOLEAN (default false) to animals table
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "add_behavior_notes"
down_revision = "add_kennel_last_cleaned"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "animals",
        sa.Column("behavior_notes", sa.Text(), nullable=True),
    )
    op.add_column(
        "animals",
        sa.Column("is_special_needs", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade():
    op.drop_column("animals", "behavior_notes")
    op.drop_column("animals", "is_special_needs")
