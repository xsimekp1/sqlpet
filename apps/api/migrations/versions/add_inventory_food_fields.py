"""Add food_type, shelf_life_days, unit_weight_g to inventory_items

Revision ID: add_inventory_food_fields
Revises: add_contacts
- Add food_type VARCHAR(20) for food sub-type (dry/wet/canned/treats/raw/other)
- Add shelf_life_days INTEGER for shelf life after opening
- Add unit_weight_g INTEGER for package weight in grams
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = "add_inventory_food_fields"
down_revision = "add_kennel_inv_food"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "inventory_items",
        sa.Column("food_type", sa.String(20), nullable=True),
    )
    op.add_column(
        "inventory_items",
        sa.Column("shelf_life_days", sa.Integer(), nullable=True),
    )
    op.add_column(
        "inventory_items",
        sa.Column("unit_weight_g", sa.Integer(), nullable=True),
    )


def downgrade():
    op.drop_column("inventory_items", "unit_weight_g")
    op.drop_column("inventory_items", "shelf_life_days")
    op.drop_column("inventory_items", "food_type")
