"""Add hotel_price_per_day to organizations

Revision ID: add_hotel_price_per_day
Revises: add_kennel_map_layout
Create Date: 2026-02-17

"""

from alembic import op
import sqlalchemy as sa

revision = "add_hotel_price_per_day"
down_revision = "add_kennel_map_layout"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "organizations",
        sa.Column("hotel_price_per_day", sa.Numeric(10, 2), nullable=True),
    )


def downgrade():
    op.drop_column("organizations", "hotel_price_per_day")
