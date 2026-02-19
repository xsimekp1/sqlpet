"""add_organization_details_fields

Revision ID: ec751ac4716d
Revises: 4c0149693c5e
Create Date: 2026-02-19 15:15:11.516419

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = "ec751ac4716d"
down_revision: Union[str, Sequence[str], None] = "4c0149693c5e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()

    # Check which columns already exist
    result = conn.execute(
        text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'organizations'
    """)
    )
    existing_columns = {row[0] for row in result}

    # Add only columns that don't exist
    if "registration_number" not in existing_columns:
        op.add_column(
            "organizations",
            sa.Column("registration_number", sa.String(20), nullable=True),
        )
    if "address" not in existing_columns:
        op.add_column("organizations", sa.Column("address", sa.Text(), nullable=True))
    if "lat" not in existing_columns:
        op.add_column("organizations", sa.Column("lat", sa.Float(), nullable=True))
    if "lng" not in existing_columns:
        op.add_column("organizations", sa.Column("lng", sa.Float(), nullable=True))
    if "capacity_dogs" not in existing_columns:
        op.add_column(
            "organizations", sa.Column("capacity_dogs", sa.Integer(), nullable=True)
        )
    if "capacity_cats" not in existing_columns:
        op.add_column(
            "organizations", sa.Column("capacity_cats", sa.Integer(), nullable=True)
        )
    if "capacity_rabbits" not in existing_columns:
        op.add_column(
            "organizations", sa.Column("capacity_rabbits", sa.Integer(), nullable=True)
        )
    if "capacity_small" not in existing_columns:
        op.add_column(
            "organizations", sa.Column("capacity_small", sa.Integer(), nullable=True)
        )
    if "capacity_birds" not in existing_columns:
        op.add_column(
            "organizations", sa.Column("capacity_birds", sa.Integer(), nullable=True)
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("organizations", "capacity_birds")
    op.drop_column("organizations", "capacity_small")
    op.drop_column("organizations", "capacity_rabbits")
    op.drop_column("organizations", "capacity_cats")
    op.drop_column("organizations", "capacity_dogs")
    op.drop_column("organizations", "lng")
    op.drop_column("organizations", "lat")
    op.drop_column("organizations", "address")
    op.drop_column("organizations", "registration_number")
