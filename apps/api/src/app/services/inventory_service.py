"""Inventory service for managing items, lots, and transactions."""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import uuid

from src.app.models.inventory_item import InventoryItem, InventoryCategory
from src.app.models.inventory_lot import InventoryLot
from src.app.models.inventory_transaction import (
    InventoryTransaction,
    TransactionType,
    TransactionReason,
    REASON_TO_DIRECTION,
)
from src.app.services.audit_service import AuditService


class InventoryService:
    def __init__(self, db: AsyncSession, audit_service: Optional[AuditService] = None):
        self.db = db
        self.audit = audit_service or AuditService(db)

    async def create_item(
        self,
        organization_id: uuid.UUID,
        name: str,
        category: InventoryCategory,
        created_by_id: uuid.UUID,
        unit: Optional[str] = None,
        reorder_threshold: Optional[float] = None,
        kcal_per_100g: Optional[float] = None,
        price_per_unit: Optional[float] = None,
        allowed_species: Optional[list] = None,
        food_type: Optional[str] = None,
        shelf_life_days: Optional[int] = None,
        unit_weight_g: Optional[int] = None,
    ) -> InventoryItem:
        """Create a new inventory item."""
        item = InventoryItem(
            id=uuid.uuid4(),
            organization_id=organization_id,
            name=name,
            category=category,
            unit=unit,
            reorder_threshold=reorder_threshold,
            kcal_per_100g=kcal_per_100g,
            price_per_unit=price_per_unit,
            allowed_species=allowed_species,
            food_type=food_type,
            shelf_life_days=shelf_life_days,
            unit_weight_g=unit_weight_g,
        )
        self.db.add(item)
        await self.db.flush()

        await self.audit.log_action(
            organization_id=organization_id,
            actor_user_id=created_by_id,
            action="create",
            entity_type="inventory_item",
            entity_id=item.id,
            after={"name": name, "category": category.value},
        )

        return item

    async def get_item_by_id(
        self,
        item_id: uuid.UUID,
        organization_id: uuid.UUID,
    ) -> Optional[InventoryItem]:
        """Fetch a single inventory item by ID scoped to organization."""
        stmt = select(InventoryItem).where(
            and_(
                InventoryItem.id == item_id,
                InventoryItem.organization_id == organization_id,
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def update_item(
        self,
        item_id: uuid.UUID,
        organization_id: uuid.UUID,
        user_id: uuid.UUID,
        **updates,
    ) -> InventoryItem:
        """Update an inventory item."""
        stmt = select(InventoryItem).where(
            and_(
                InventoryItem.id == item_id,
                InventoryItem.organization_id == organization_id,
            )
        )
        result = await self.db.execute(stmt)
        item = result.scalar_one_or_none()

        if not item:
            raise ValueError(f"Inventory item {item_id} not found")

        changes = {}
        for key, value in updates.items():
            if hasattr(item, key) and getattr(item, key) != value:
                old_value = getattr(item, key)
                setattr(item, key, value)
                changes[key] = {"old": str(old_value), "new": str(value)}

        if changes:
            await self.db.flush()
            await self.audit.log_action(
                organization_id=organization_id,
                actor_user_id=user_id,
                action="update",
                entity_type="inventory_item",
                entity_id=item.id,
                after=changes,
            )

        return item

    async def create_lot(
        self,
        organization_id: uuid.UUID,
        item_id: uuid.UUID,
        quantity: float,
        created_by_id: uuid.UUID,
        lot_number: Optional[str] = None,
        expires_at: Optional[datetime] = None,
        cost_per_unit: Optional[float] = None,
    ) -> InventoryLot:
        """Create a new inventory lot."""
        # Verify item belongs to organization
        item_stmt = select(InventoryItem).where(
            and_(
                InventoryItem.id == item_id,
                InventoryItem.organization_id == organization_id,
            )
        )
        item_result = await self.db.execute(item_stmt)
        item = item_result.scalar_one_or_none()

        if not item:
            raise ValueError(f"Inventory item {item_id} not found")

        lot = InventoryLot(
            id=uuid.uuid4(),
            organization_id=organization_id,
            item_id=item_id,
            lot_number=lot_number,
            expires_at=expires_at,
            quantity=0,
            cost_per_unit=cost_per_unit,
        )
        self.db.add(lot)
        await self.db.flush()

        # Record transaction for initial stock
        await self.record_transaction(
            organization_id=organization_id,
            item_id=item_id,
            lot_id=lot.id,
            reason=TransactionReason.OPENING_BALANCE,
            quantity=quantity,
            note=f"Initial stock for lot {lot_number or lot.id}",
            user_id=created_by_id,
        )

        await self.audit.log_action(
            organization_id=organization_id,
            actor_user_id=created_by_id,
            action="create",
            entity_type="inventory_lot",
            entity_id=lot.id,
            after={"item_id": str(item_id), "quantity": quantity},
        )

        return lot

    async def update_lot(
        self,
        lot_id: uuid.UUID,
        organization_id: uuid.UUID,
        user_id: uuid.UUID,
        **updates,
    ) -> InventoryLot:
        """Update an inventory lot."""
        stmt = select(InventoryLot).where(
            and_(
                InventoryLot.id == lot_id,
                InventoryLot.organization_id == organization_id,
            )
        )
        result = await self.db.execute(stmt)
        lot = result.scalar_one_or_none()

        if not lot:
            raise ValueError(f"Inventory lot {lot_id} not found")

        changes = {}
        for key, value in updates.items():
            if hasattr(lot, key) and getattr(lot, key) != value:
                old_value = getattr(lot, key)
                setattr(lot, key, value)
                changes[key] = {"old": str(old_value), "new": str(value)}

        if changes:
            await self.db.flush()
            await self.audit.log_action(
                organization_id=organization_id,
                actor_user_id=user_id,
                action="update",
                entity_type="inventory_lot",
                entity_id=lot.id,
                after=changes,
            )

        return lot

    async def record_transaction(
        self,
        organization_id: uuid.UUID,
        item_id: uuid.UUID,
        reason: TransactionReason,
        quantity: float | Decimal,
        note: Optional[str] = None,
        lot_id: Optional[uuid.UUID] = None,
        related_entity_type: Optional[str] = None,
        related_entity_id: Optional[uuid.UUID] = None,
        user_id: Optional[uuid.UUID] = None,
    ) -> InventoryTransaction:
        """Record an inventory transaction and update item quantity_current.

        Validates that reason is consistent with direction:
        - IN: opening_balance, purchase, donation
        - OUT: consumption, writeoff

        Prevents negative stock.
        """
        # Normalize quantity to float for consistent arithmetic with Numeric columns
        quantity = float(quantity)

        # Validate reason -> direction mapping
        direction = REASON_TO_DIRECTION.get(reason)
        if not direction:
            raise ValueError(f"Invalid transaction reason: {reason}")

        # Calculate delta based on direction
        if direction == TransactionType.IN:
            quantity_delta = quantity
        elif direction == TransactionType.OUT:
            quantity_delta = -abs(quantity)
        else:  # ADJUST
            quantity_delta = quantity

        # Get current item to check if we can deduct
        item_stmt = select(InventoryItem).where(
            and_(
                InventoryItem.id == item_id,
                InventoryItem.organization_id == organization_id,
            )
        )
        item_result = await self.db.execute(item_stmt)
        item = item_result.scalar_one_or_none()

        if not item:
            raise ValueError(f"Inventory item not found: {item_id}")

        # Check for negative stock prevention
        new_quantity = float(item.quantity_current or 0) + quantity_delta
        if new_quantity < 0:
            raise ValueError(
                f"Cannot {reason.value}: stock would be negative. "
                f"Current: {item.quantity_current}, Requested: {abs(quantity_delta)}"
            )

        # Create transaction record
        transaction = InventoryTransaction(
            id=uuid.uuid4(),
            organization_id=organization_id,
            item_id=item_id,
            lot_id=lot_id,
            direction=direction,
            reason=reason,
            quantity=abs(quantity),
            note=note,
            related_entity_type=related_entity_type,
            related_entity_id=related_entity_id,
            created_by_user_id=user_id,
        )
        self.db.add(transaction)

        # Update item quantity_current (cache)
        item.quantity_current = new_quantity

        # Update lot quantity if lot_id provided
        if lot_id:
            lot_stmt = select(InventoryLot).where(InventoryLot.id == lot_id)
            lot_result = await self.db.execute(lot_stmt)
            lot = lot_result.scalar_one_or_none()

            if lot:
                if direction == TransactionType.IN:
                    lot.quantity = float(lot.quantity or 0) + quantity
                elif direction == TransactionType.OUT:
                    lot.quantity = max(0, float(lot.quantity or 0) - abs(quantity))
                elif direction == TransactionType.ADJUST:
                    lot.quantity = quantity

        await self.db.flush()

        if user_id:
            await self.audit.log_action(
                organization_id=organization_id,
                actor_user_id=user_id,
                action="create",
                entity_type="inventory_transaction",
                entity_id=transaction.id,
                after={
                    "reason": reason.value,
                    "direction": direction.value,
                    "quantity": quantity,
                    "item_id": str(item_id),
                },
            )

        return transaction

    async def deduct_for_feeding(
        self,
        organization_id: uuid.UUID,
        food_name: str,
        amount_g: float,
        feeding_log_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> Dict[str, Any]:
        """
        Deduct inventory for feeding.
        Uses FIFO (First In First Out) - deducts from lot with earliest expiry date.
        """
        # Find inventory item matching food name (case-insensitive)
        item_stmt = select(InventoryItem).where(
            and_(
                InventoryItem.organization_id == organization_id,
                func.lower(InventoryItem.name) == func.lower(food_name),
                InventoryItem.category == InventoryCategory.FOOD,
            )
        )
        item_result = await self.db.execute(item_stmt)
        item = item_result.scalar_one_or_none()

        if not item:
            raise ValueError(f"No inventory item found for food: {food_name}")

        # Find lot with stock (FIFO: earliest expiry first)
        lot_stmt = (
            select(InventoryLot)
            .where(
                and_(
                    InventoryLot.item_id == item.id,
                    InventoryLot.quantity > 0,
                )
            )
            .order_by(InventoryLot.expires_at.asc().nullslast())
            .limit(1)
        )
        lot_result = await self.db.execute(lot_stmt)
        lot = lot_result.scalar_one_or_none()

        if not lot:
            raise ValueError(f"No stock available for item: {item.name}")

        # Convert grams to item unit (assume kg for MVP)
        quantity_to_deduct = amount_g / 1000.0  # g → kg

        if lot.quantity < quantity_to_deduct:
            # Partial deduction - use all remaining in this lot
            quantity_to_deduct = float(lot.quantity)

        # Record transaction
        transaction = await self.record_transaction(
            organization_id=organization_id,
            item_id=item.id,
            lot_id=lot.id,
            reason=TransactionReason.CONSUMPTION,
            quantity=quantity_to_deduct,
            note=f"Fed animal (feeding_log #{feeding_log_id})",
            related_entity_type="feeding_log",
            related_entity_id=feeding_log_id,
            user_id=user_id,
        )

        return {
            "item": item,
            "lot": lot,
            "quantity_deducted": quantity_to_deduct,
            "transaction": transaction,
        }

    async def get_items_with_stock(
        self,
        organization_id: uuid.UUID,
        category: Optional[InventoryCategory] = None,
        low_stock_only: bool = False,
    ) -> List[Dict[str, Any]]:
        """Get inventory items with aggregated stock information."""
        # Build base query
        conditions = [InventoryItem.organization_id == organization_id]
        if category:
            conditions.append(InventoryItem.category == category)

        items_stmt = select(InventoryItem).where(and_(*conditions))
        items_result = await self.db.execute(items_stmt)
        items = items_result.scalars().all()

        result = []
        for item in items:
            # Get total quantity across all lots
            lots_stmt = select(
                func.sum(InventoryLot.quantity).label("total_quantity"),
                func.count(InventoryLot.id).label("lots_count"),
                func.min(InventoryLot.expires_at).label("oldest_expiry"),
            ).where(InventoryLot.item_id == item.id)
            lots_result = await self.db.execute(lots_stmt)
            lots_data = lots_result.one()

            total_quantity = float(lots_data.total_quantity or 0)

            # Apply low stock filter
            if low_stock_only:
                if item.reorder_threshold is None:
                    continue
                if total_quantity >= item.reorder_threshold:
                    continue

            result.append(
                {
                    "item": item,
                    "total_quantity": total_quantity,
                    "lots_count": lots_data.lots_count,
                    "oldest_expiry": lots_data.oldest_expiry,
                }
            )

        return result

    async def get_transaction_history(
        self,
        organization_id: uuid.UUID,
        item_id: Optional[uuid.UUID] = None,
        days: int = 90,
        page: int = 1,
        page_size: int = 50,
    ) -> List[InventoryTransaction]:
        """Get transaction history with pagination."""
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)

        conditions = [
            InventoryTransaction.organization_id == organization_id,
            InventoryTransaction.created_at >= cutoff_date,
        ]
        if item_id:
            conditions.append(InventoryTransaction.item_id == item_id)

        stmt = (
            select(InventoryTransaction)
            .where(and_(*conditions))
            .order_by(InventoryTransaction.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()
