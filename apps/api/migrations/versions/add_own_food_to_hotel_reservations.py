"""Add own_food to hotel_reservations

Revision ID: add_own_food_to_hotel_reservations
Revises: registered_shelters
Create Date: 2026-02-19

"""

from alembic import op
import sqlalchemy as sa

revision = "20260219_own_food_hotel"
down_revision = "registered_shelters"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "hotel_reservations",
        sa.Column("own_food", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade():
    op.drop_column("hotel_reservations", "own_food")
