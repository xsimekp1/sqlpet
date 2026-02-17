"""Add hotel_price_per_day to organizations

Revision ID: add_hotel_price_per_day_org
Revises: add_animal_id_to_hotel_reservations
Create Date: 2026-02-17

"""

from alembic import op
import sqlalchemy as sa


revision = "add_hotel_price_per_day_org"
down_revision = "add_animal_id_to_hotel_reservations"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "organizations",
        sa.Column("hotel_price_per_day", sa.Numeric(10, 2), nullable=True),
    )


def downgrade():
    op.drop_column("organizations", "hotel_price_per_day")
