"""Add last_cleaned_at to kennels

Revision ID: add_kennel_last_cleaned
Revises: add_feeding_plan_mer
- Add last_cleaned_at TIMESTAMP WITH TIME ZONE (nullable) to kennels table
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "add_kennel_last_cleaned"
down_revision = "add_feeding_plan_mer"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "kennels",
        sa.Column("last_cleaned_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_column("kennels", "last_cleaned_at")
