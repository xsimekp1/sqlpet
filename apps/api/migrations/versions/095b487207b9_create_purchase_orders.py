"""create_purchase_orders

Revision ID: 095b487207b9
Revises: 845d0e8ad167
Create Date: 2026-02-20 19:04:20.411656

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = '095b487207b9'
down_revision: Union[str, Sequence[str], None] = '845d0e8ad167'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create purchase_orders table
    op.create_table(
        'purchase_orders',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('po_number', sa.String(length=50), nullable=False),
        sa.Column('supplier_name', sa.String(length=255), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='ordered'),
        sa.Column('ordered_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('ordered_by_user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('expected_delivery_date', sa.Date(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('total_items', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('received_items', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.CheckConstraint("status IN ('ordered', 'partially_received', 'received', 'cancelled')", name='check_po_status'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['ordered_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for purchase_orders
    op.create_index('idx_po_number_org', 'purchase_orders', ['organization_id', 'po_number'], unique=True)
    op.create_index('idx_po_org_status', 'purchase_orders', ['organization_id', 'status'])
    op.create_index('idx_po_ordered_at', 'purchase_orders', ['ordered_at'], postgresql_using='btree', postgresql_ops={'ordered_at': 'DESC'})

    # Create purchase_order_items table
    op.create_table(
        'purchase_order_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False, server_default=sa.text('gen_random_uuid()')),
        sa.Column('purchase_order_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('inventory_item_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('quantity_ordered', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('quantity_received', sa.Numeric(precision=10, scale=2), nullable=False, server_default='0'),
        sa.Column('unit_price', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.CheckConstraint('quantity_ordered > 0', name='check_quantity_ordered_positive'),
        sa.CheckConstraint('quantity_received >= 0', name='check_quantity_received_non_negative'),
        sa.ForeignKeyConstraint(['purchase_order_id'], ['purchase_orders.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['inventory_item_id'], ['inventory_items.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for purchase_order_items
    op.create_index('idx_po_items_po', 'purchase_order_items', ['purchase_order_id'])
    op.create_index('idx_po_items_item', 'purchase_order_items', ['inventory_item_id'])


def downgrade() -> None:
    """Downgrade schema."""
    # Drop purchase_order_items table and indexes
    op.drop_index('idx_po_items_item', table_name='purchase_order_items')
    op.drop_index('idx_po_items_po', table_name='purchase_order_items')
    op.drop_table('purchase_order_items')

    # Drop purchase_orders table and indexes
    op.drop_index('idx_po_ordered_at', table_name='purchase_orders')
    op.drop_index('idx_po_org_status', table_name='purchase_orders')
    op.drop_index('idx_po_number_org', table_name='purchase_orders')
    op.drop_table('purchase_orders')
