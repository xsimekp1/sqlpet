"""Add inventory transactions direction/reason and quantity_current cache

Revision ID: add_inventory_transactions_v2
Revises: 148e97522a3b
Create Date: 2026-02-20

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text, inspect
from sqlalchemy.dialects.postgresql import UUID

revision = "add_inventory_transactions_v2"
down_revision = "148e97522a3b"
branch_labels = None
depends_on = None


def upgrade():
    # Check existing columns in inventory_transactions
    inspector = inspect(op.get_bind())
    tx_columns = [c["name"] for c in inspector.get_columns("inventory_transactions")]

    # 1. Add direction column if not exists
    if "direction" not in tx_columns:
        op.add_column(
            "inventory_transactions",
            sa.Column(
                "direction",
                sa.Enum(
                    "in",
                    "out",
                    "adjust",
                    name="inventory_transaction_direction_enum",
                    create_constraint=False,
                    native_enum=False,
                ),
                nullable=False,
                server_default="in",
            ),
        )
    else:
        # Ensure enum type exists for direction
        op.execute(
            text("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_transaction_direction_enum') THEN
                    CREATE TYPE inventory_transaction_direction_enum AS ENUM ('in', 'out', 'adjust');
                END IF;
            END $$;
        """)
        )

    # 2. Add reason column if not exists
    if "reason" not in tx_columns:
        op.add_column(
            "inventory_transactions",
            sa.Column(
                "reason",
                sa.Enum(
                    "opening_balance",
                    "purchase",
                    "donation",
                    "consumption",
                    "writeoff",
                    name="inventory_transaction_reason_enum",
                    create_constraint=False,
                    native_enum=False,
                ),
                nullable=False,
                server_default="opening_balance",
            ),
        )
    else:
        # Ensure enum type exists for reason
        op.execute(
            text("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_transaction_reason_enum') THEN
                    CREATE TYPE inventory_transaction_reason_enum AS ENUM ('opening_balance', 'purchase', 'donation', 'consumption', 'writeoff');
                END IF;
            END $$;
        """)
        )

    # 3. Migrate existing data: set direction based on existing type
    # Only if type column exists and direction needs updating
    if "type" in tx_columns:
        op.execute(
            text("""
            UPDATE inventory_transactions 
            SET direction = type::text::inventory_transaction_direction_enum
            WHERE type IS NOT NULL AND (direction IS NULL OR direction = 'in'::inventory_transaction_direction_enum)
        """)
        )
        # Drop old type column if exists
        op.drop_column("inventory_transactions", "type")

    # 4. Ensure reason has valid values (set to opening_balance for NULL)
    op.execute(
        text("""
        UPDATE inventory_transactions 
        SET reason = 'opening_balance'::inventory_transaction_reason_enum
        WHERE reason IS NULL OR reason NOT IN ('opening_balance', 'purchase', 'donation', 'consumption', 'writeoff')
    """)
    )

    # 5. Check and add quantity_current cache to inventory_items
    item_columns = [c["name"] for c in inspector.get_columns("inventory_items")]
    if "quantity_current" not in item_columns:
        op.add_column(
            "inventory_items",
            sa.Column(
                "quantity_current",
                sa.Numeric(10, 2),
                nullable=False,
                server_default="0",
            ),
        )

    # 6. Update quantity_current from transaction sums (idempotent)
    op.execute(
        text("""
        UPDATE inventory_items i
        SET quantity_current = COALESCE(
            (SELECT SUM(
                CASE t.direction 
                    WHEN 'in' THEN t.quantity 
                    WHEN 'out' THEN -t.quantity 
                    ELSE 0 
                END
            ) FROM inventory_transactions t WHERE t.item_id = i.id),
            0
        )
    """)
    )

    # 7. Create index on (item_id, created_at) if not exists
    try:
        op.create_index(
            "ix_inventory_transactions_item_created",
            "inventory_transactions",
            ["item_id", "created_at"],
        )
    except Exception:
        pass  # Index may already exist


def downgrade():
    op.drop_index(
        "ix_inventory_transactions_item_created", table_name="inventory_transactions"
    )
    op.drop_column("inventory_items", "quantity_current")

    # Note: This is a best-effort downgrade - might not fully restore original state
    # because we've already potentially modified/dropped the old 'type' column
    pass
