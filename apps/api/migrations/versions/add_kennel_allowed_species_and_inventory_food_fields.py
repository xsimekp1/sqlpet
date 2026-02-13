"""Add allowed_species to kennels and food fields to inventory_items

Revision ID: add_kennel_and_inventory_food_fields
Revises: add_weight_logs
Create Date: 2026-02-13

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "add_kennel_inv_food"
down_revision = "add_weight_logs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Kennels: allowed_species (JSON array of species strings)
    op.add_column(
        "kennels",
        sa.Column("allowed_species", JSONB, nullable=True),
    )

    # Inventory items: food-specific fields
    op.add_column(
        "inventory_items",
        sa.Column("kcal_per_100g", sa.Numeric(7, 2), nullable=True),
    )
    op.add_column(
        "inventory_items",
        sa.Column("price_per_unit", sa.Numeric(10, 2), nullable=True),
    )
    op.add_column(
        "inventory_items",
        sa.Column("allowed_species", JSONB, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("inventory_items", "allowed_species")
    op.drop_column("inventory_items", "price_per_unit")
    op.drop_column("inventory_items", "kcal_per_100g")
    op.drop_column("kennels", "allowed_species")
