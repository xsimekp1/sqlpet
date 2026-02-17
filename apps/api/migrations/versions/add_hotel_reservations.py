"""add hotel_reservations table

Revision ID: add_hotel_reservations
Revises: add_hotel_with_owner_status
Create Date: 2026-02-16

"""

from typing import Sequence, Union
import uuid
from datetime import date

from alembic import op
import sqlalchemy as sa


revision: str = "add_hotel_reservations"
down_revision: Union[str, Sequence[str], None] = (
    "add_hotel_with_owner",
    "add_intake_outcome_dates",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "hotel_reservations",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column(
            "organization_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "kennel_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("kennels.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "contact_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("contacts.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
        sa.Column("animal_name", sa.String(255), nullable=False),
        sa.Column("animal_species", sa.String(50), nullable=False),
        sa.Column("animal_breed", sa.String(255), nullable=True),
        sa.Column("animal_notes", sa.Text, nullable=True),
        sa.Column("reserved_from", sa.Date, nullable=False),
        sa.Column("reserved_to", sa.Date, nullable=False),
        sa.Column("price_per_day", sa.Numeric(10, 2), nullable=True),
        sa.Column("total_price", sa.Numeric(10, 2), nullable=True),
        sa.Column("is_paid", sa.Boolean, server_default="false", nullable=False),
        sa.Column(
            "requires_single_cage", sa.Boolean, server_default="false", nullable=False
        ),
        sa.Column("status", sa.String(50), server_default="pending", nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_hotel_reservations_organization_id",
        "hotel_reservations",
        ["organization_id"],
    )
    op.create_index(
        "ix_hotel_reservations_kennel_id", "hotel_reservations", ["kennel_id"]
    )
    op.create_index(
        "ix_hotel_reservations_contact_id", "hotel_reservations", ["contact_id"]
    )
    op.create_index(
        "ix_hotel_reservations_reserved_from", "hotel_reservations", ["reserved_from"]
    )
    op.create_index(
        "ix_hotel_reservations_reserved_to", "hotel_reservations", ["reserved_to"]
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_hotel_reservations_reserved_to", table_name="hotel_reservations")
    op.drop_index(
        "ix_hotel_reservations_reserved_from", table_name="hotel_reservations"
    )
    op.drop_index("ix_hotel_reservations_contact_id", table_name="hotel_reservations")
    op.drop_index("ix_hotel_reservations_kennel_id", table_name="hotel_reservations")
    op.drop_index(
        "ix_hotel_reservations_organization_id", table_name="hotel_reservations"
    )
    op.drop_table("hotel_reservations")
