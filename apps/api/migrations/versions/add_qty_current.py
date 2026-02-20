"""Add quantity_current to inventory_items

Revision ID: add_qty_current
Revises: add_inventory_transactions_v2
Create Date: 2026-02-20

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = "add_qty_current"
down_revision = "148e97522a3b"
branch_labels = None
depends_on = None


def upgrade():
    # Check if column already exists
    op.execute(
        text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = 'inventory_items' AND column_name = 'quantity_current'
            ) THEN
                ALTER TABLE inventory_items ADD COLUMN quantity_current NUMERIC(10,2) NOT NULL DEFAULT 0;
            END IF;
        END $$;
    """)
    )

    # Backfill from lots - sum lot quantities per item
    op.execute(
        text("""
        UPDATE inventory_items i
        SET quantity_current = COALESCE(
            (SELECT SUM(l.quantity) FROM inventory_lots l WHERE l.item_id = i.id AND l.quantity > 0),
            0
        )
    """)
    )


def downgrade():
    op.drop_column("inventory_items", "quantity_current")
