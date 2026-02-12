"""Add inventory and feeding tables

Revision ID: 007_add_inventory_feeding
Revises: 006_add_tasks_table
Create Date: 2026-02-12 01:00:00

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = "007_add_inventory_feeding"
down_revision = "006_add_tasks_table"
branch_labels = None
depends_on = None


def upgrade():
    """Create inventory and feeding tables."""

    # Create foods table
    op.create_table(
        'foods',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('brand', sa.String(length=255), nullable=True),
        sa.Column('type', sa.Enum('dry', 'wet', 'raw', 'medical', 'other', name='food_type_enum', native_enum=False), nullable=False),
        sa.Column('kcal_per_100g', sa.Numeric(precision=6, scale=2), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_foods_organization_id', 'foods', ['organization_id'], unique=False)

    # Create inventory_items table
    op.create_table(
        'inventory_items',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('category', sa.Enum('medication', 'vaccine', 'food', 'supply', 'other', name='inventory_category_enum', native_enum=False), nullable=False),
        sa.Column('unit', sa.String(length=50), nullable=True),
        sa.Column('reorder_threshold', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_inventory_items_organization_id', 'inventory_items', ['organization_id'], unique=False)

    # Create inventory_lots table
    op.create_table(
        'inventory_lots',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=False),
        sa.Column('item_id', sa.UUID(), nullable=False),
        sa.Column('lot_number', sa.String(length=100), nullable=True),
        sa.Column('expires_at', sa.Date(), nullable=True),
        sa.Column('quantity', sa.Numeric(precision=10, scale=2), nullable=False, server_default='0'),
        sa.Column('cost_per_unit', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['item_id'], ['inventory_items.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_inventory_lots_organization_id', 'inventory_lots', ['organization_id'], unique=False)
    op.create_index('ix_inventory_lots_item_id', 'inventory_lots', ['item_id'], unique=False)
    op.create_index('ix_inventory_lots_expires_at', 'inventory_lots', ['expires_at'], unique=False)

    # Create inventory_transactions table
    op.create_table(
        'inventory_transactions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=False),
        sa.Column('item_id', sa.UUID(), nullable=False),
        sa.Column('lot_id', sa.UUID(), nullable=True),
        sa.Column('type', sa.Enum('in', 'out', 'adjust', name='inventory_transaction_type_enum', native_enum=False), nullable=False),
        sa.Column('quantity', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('related_entity_type', sa.String(length=50), nullable=True),
        sa.Column('related_entity_id', sa.UUID(), nullable=True),
        sa.Column('created_by_user_id', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['item_id'], ['inventory_items.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['lot_id'], ['inventory_lots.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_inventory_transactions_organization_id', 'inventory_transactions', ['organization_id'], unique=False)
    op.create_index('ix_inventory_transactions_item_id', 'inventory_transactions', ['item_id'], unique=False)
    op.create_index('ix_inventory_transactions_related', 'inventory_transactions', ['related_entity_type', 'related_entity_id'], unique=False)
    op.create_index('ix_inventory_transactions_created_at', 'inventory_transactions', ['created_at'], unique=False)

    # Create feeding_plans table
    op.create_table(
        'feeding_plans',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=False),
        sa.Column('animal_id', sa.UUID(), nullable=False),
        sa.Column('food_id', sa.UUID(), nullable=True),
        sa.Column('amount_g', sa.Numeric(precision=8, scale=2), nullable=True),
        sa.Column('amount_text', sa.Text(), nullable=True),
        sa.Column('times_per_day', sa.Integer(), nullable=True),
        sa.Column('schedule_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['animal_id'], ['animals.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['food_id'], ['foods.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_feeding_plans_organization_id', 'feeding_plans', ['organization_id'], unique=False)
    op.create_index('ix_feeding_plans_animal_id', 'feeding_plans', ['animal_id'], unique=False)
    op.create_index('ix_feeding_plans_is_active', 'feeding_plans', ['is_active'], unique=False)

    # Create feeding_logs table
    op.create_table(
        'feeding_logs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('organization_id', sa.UUID(), nullable=False),
        sa.Column('animal_id', sa.UUID(), nullable=False),
        sa.Column('fed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('fed_by_user_id', sa.UUID(), nullable=True),
        sa.Column('amount_text', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['animal_id'], ['animals.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['fed_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_feeding_logs_organization_id', 'feeding_logs', ['organization_id'], unique=False)
    op.create_index('ix_feeding_logs_animal_id', 'feeding_logs', ['animal_id'], unique=False)
    op.create_index('ix_feeding_logs_fed_at', 'feeding_logs', ['fed_at'], unique=False)


def downgrade():
    """Drop inventory and feeding tables."""
    op.drop_table('feeding_logs')
    op.drop_table('feeding_plans')
    op.drop_table('inventory_transactions')
    op.drop_table('inventory_lots')
    op.drop_table('inventory_items')
    op.drop_table('foods')
