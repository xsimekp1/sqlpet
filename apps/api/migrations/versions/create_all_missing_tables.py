"""Create all missing tables

Revision ID: create_all_missing_tables
Revises: add_hotel_price_per_day
Create Date: 2026-02-17

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "create_all_missing_tables"
down_revision = "add_hotel_price_per_day"
branch_labels = None
depends_on = None


def upgrade():
    # Create hotel_reservations table
    op.create_table(
        "hotel_reservations",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("kennel_id", sa.UUID(), nullable=True),
        sa.Column("contact_id", sa.UUID(), nullable=True),
        sa.Column("animal_name", sa.String(length=255), nullable=False),
        sa.Column("animal_species", sa.String(length=50), nullable=True),
        sa.Column("animal_breed", sa.String(length=255), nullable=True),
        sa.Column("animal_notes", sa.Text(), nullable=True),
        sa.Column("animal_id", sa.UUID(), nullable=True),
        sa.Column("reserved_from", sa.Date(), nullable=False),
        sa.Column("reserved_to", sa.Date(), nullable=False),
        sa.Column("price_per_day", sa.Numeric(10, 2), nullable=True),
        sa.Column("total_price", sa.Numeric(10, 2), nullable=True),
        sa.Column("is_paid", sa.Boolean(), nullable=True, server_default="false"),
        sa.Column(
            "requires_single_cage", sa.Boolean(), nullable=True, server_default="false"
        ),
        sa.Column(
            "status", sa.String(length=50), nullable=True, server_default="pending"
        ),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(), nullable=True, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(), nullable=True, server_default=sa.func.now()
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_hotel_reservations_org", "hotel_reservations", ["organization_id"]
    )


def downgrade():
    op.drop_table("hotel_reservations")
