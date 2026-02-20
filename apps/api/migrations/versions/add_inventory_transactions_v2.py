"""Add inventory transactions direction/reason and quantity_current cache

Revision ID: add_inventory_transactions_v2
Revises: 148e97522a3b
Create Date: 2026-02-20

"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import UUID

revision = "add_inventory_transactions_v2"
down_revision = "148e97522a3b"
branch_labels = None
depends_on = None


def upgrade():
    # 1. Add direction column to inventory_transactions
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

    # 2. Add reason column to inventory_transactions
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

    # 3. Migrate existing data: set direction based on existing type, reason as opening_balance
    op.execute(
        text("""
        UPDATE inventory_transactions 
        SET direction = type::text::inventory_transaction_direction_enum,
            reason = 'opening_balance'::inventory_transaction_reason_enum
        WHERE type IS NOT NULL
    """)
    )

    # 4. Drop old columns (type and reason - we're replacing with new schema)
    op.drop_column("inventory_transactions", "type")
    op.drop_column("inventory_transactions", "reason")

    # 5. Add quantity_current cache to inventory_items
    op.add_column(
        "inventory_items",
        sa.Column(
            "quantity_current", sa.Numeric(10, 2), nullable=False, server_default="0"
        ),
    )

    # 6. Create opening_balance transactions from existing lot quantities
    # For items with lots that have quantities: sum lot quantities as opening_balance
    op.execute(
        text("""
        INSERT INTO inventory_transactions 
            (id, organization_id, item_id, lot_id, direction, reason, quantity, note, created_at, updated_at)
        SELECT 
            gen_random_uuid() as id,
            l.organization_id,
            l.item_id,
            l.id as lot_id,
            'in'::inventory_transaction_direction_enum as direction,
            'opening_balance'::inventory_transaction_reason_enum as reason,
            COALESCE(l.quantity, 0) as quantity,
            'Initial lot quantity' as note,
            COALESCE(l.created_at, NOW()) as created_at,
            COALESCE(l.updated_at, NOW()) as updated_at
        FROM inventory_lots l
        WHERE l.quantity IS NOT NULL AND l.quantity > 0
    """)
    )

    # 7. Update quantity_current from the sum of opening_balance transactions per item
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

    # 8. Create index on (item_id, created_at) for faster transaction queries
    op.create_index(
        "ix_inventory_transactions_item_created",
        "inventory_transactions",
        ["item_id", "created_at"],
    )


def downgrade():
    op.drop_index("ix_inventory_transactions_item_created", "inventory_transactions")
    op.drop_column("inventory_items", "quantity_current")
    op.add_column(
        "inventory_transactions",
        sa.Column(
            "type",
            sa.Enum(
                "in",
                "out",
                "adjust",
                name="inventory_transaction_type_enum",
                create_constraint=False,
                native_enum=False,
            ),
            nullable=False,
        ),
    )
    op.add_column(
        "inventory_transactions",
        sa.Column(
            "reason", sa.Text(), nullable=False, server_default="opening_balance"
        ),
    )
    op.execute(
        text(
            "UPDATE inventory_transactions SET type = direction::text::inventory_transaction_type_enum, reason = reason::text"
        )
    )
    op.drop_column("inventory_transactions", "direction")
    op.drop_column("inventory_transactions", "reason")
