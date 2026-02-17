"""add hotel_price_per_day to organizations

Revision ID: add_hotel_price_per_day
Revises: add_kennel_id_to_intakes
Create Date: 2026-02-17

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_hotel_price_per_day"
down_revision: Union[str, Sequence[str], None] = "add_kennel_id_to_intakes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("hotel_price_per_day", sa.Numeric(10, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("organizations", "hotel_price_per_day")
