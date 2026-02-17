"""add kennel_id to intakes and make animal_id nullable for hotel

Revision ID: add_kennel_id_to_intakes
Revises: add_hotel_reservations
Create Date: 2026-02-17

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_kennel_id_to_intakes"
down_revision: Union[str, Sequence[str], None] = "add_hotel_reservations"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add kennel_id column (nullable)
    op.add_column(
        "intakes",
        sa.Column(
            "kennel_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("kennels.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_intakes_kennel_id", "intakes", ["kennel_id"])

    # Make animal_id nullable for hotel intakes
    op.alter_column("intakes", "animal_id", nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_intakes_kennel_id", table_name="intakes")
    op.drop_column("intakes", "kennel_id")
    op.alter_column("intakes", "animal_id", nullable=False)
