"""Add animal_id to hotel_reservations

Revision ID: add_animal_id_to_hotel_reservations
Revises: create_all_missing_tables
Create Date: 2026-02-17

"""

from alembic import op
import sqlalchemy as sa


revision = "add_animal_id_to_hotel_reservations"
down_revision = "create_all_missing_tables"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "hotel_reservations",
        sa.Column("animal_id", sa.UUID(), nullable=True),
    )
    op.create_index(
        "ix_hotel_reservations_animal_id",
        "hotel_reservations",
        ["animal_id"],
        postgresql_where=sa.text("animal_id IS NOT NULL"),
    )


def downgrade():
    op.drop_index(
        "ix_hotel_reservations_animal_id",
        table_name="hotel_reservations",
    )
    op.drop_column("hotel_reservations", "animal_id")
