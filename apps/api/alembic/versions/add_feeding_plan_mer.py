"""Add mer_calculation JSONB to feeding_plans

Revision ID: add_feeding_plan_mer
Revises: add_bcs
- Add mer_calculation JSONB (nullable) to feeding_plans for storing MER snapshot at plan creation
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers
revision = "add_feeding_plan_mer"
down_revision = "add_bcs"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "feeding_plans",
        sa.Column("mer_calculation", JSONB, nullable=True),
    )


def downgrade():
    op.drop_column("feeding_plans", "mer_calculation")
