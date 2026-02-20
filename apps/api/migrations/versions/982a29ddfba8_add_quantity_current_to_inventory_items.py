"""add_quantity_current_to_inventory_items

Revision ID: 982a29ddfba8
Revises: 56408710e94d
Create Date: 2026-02-20 20:24:59.180987

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = '982a29ddfba8'
down_revision: Union[str, Sequence[str], None] = '56408710e94d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add quantity_current column to inventory_items and backfill from lots."""
    # Add column if it doesn't exist (idempotent)
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
        WHERE quantity_current = 0 OR quantity_current IS NULL
        """)
    )


def downgrade() -> None:
    """Remove quantity_current column."""
    op.drop_column("inventory_items", "quantity_current")
