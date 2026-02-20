"""Purchase order service for managing supplier orders and receiving goods."""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_
from typing import List, Optional, Dict, Any
from datetime import datetime
from decimal import Decimal
import uuid

from src.app.models.purchase_order import PurchaseOrder, PurchaseOrderItem
from src.app.models.inventory_item import InventoryItem
from src.app.models.inventory_lot import InventoryLot
from src.app.models.inventory_transaction import TransactionReason
from src.app.services.inventory_service import InventoryService
from src.app.services.audit_service import AuditService
from src.app.schemas.purchase_order import (
    PurchaseOrderCreate,
    ReceivePurchaseOrder,
)


class PurchaseService:
    """Service for managing purchase orders."""

    def __init__(self, db: AsyncSession, audit_service: Optional[AuditService] = None):
        self.db = db
        self.audit = audit_service or AuditService(db)
        self.inventory_service = InventoryService(db, audit_service)

    async def generate_po_number(self, organization_id: uuid.UUID) -> str:
        """Generate a unique PO number in format PO-YYYY-NNNN.

        Example: PO-2026-0001, PO-2026-0002, etc.
        """
        current_year = datetime.utcnow().year
        prefix = f"PO-{current_year}-"

        # Find the highest PO number for this year
        stmt = (
            select(PurchaseOrder.po_number)
            .where(
                and_(
                    PurchaseOrder.organization_id == organization_id,
                    PurchaseOrder.po_number.like(f"{prefix}%"),
                )
            )
            .order_by(PurchaseOrder.po_number.desc())
        )
        result = await self.db.execute(stmt)
        last_po = result.scalar_one_or_none()

        if last_po:
            # Extract the sequence number and increment
            last_seq = int(last_po.split("-")[-1])
            next_seq = last_seq + 1
        else:
            # First PO of the year
            next_seq = 1

        return f"{prefix}{next_seq:04d}"

    async def create_purchase_order(
        self,
        organization_id: uuid.UUID,
        user_id: uuid.UUID,
        data: PurchaseOrderCreate,
    ) -> PurchaseOrder:
        """Create a new purchase order with status='ordered'.

        This implements Option B from the plan: directly create an ordered PO,
        skipping the draft status for faster UX.
        """
        # Generate PO number
        po_number = await self.generate_po_number(organization_id)

        # Validate all inventory items exist and belong to the organization
        item_ids = [item.inventory_item_id for item in data.items]
        stmt = select(InventoryItem).where(
            and_(
                InventoryItem.id.in_(item_ids),
                InventoryItem.organization_id == organization_id,
            )
        )
        result = await self.db.execute(stmt)
        inventory_items = result.scalars().all()

        if len(inventory_items) != len(item_ids):
            raise ValueError("One or more inventory items not found")

        # Create inventory item ID to name mapping
        item_names = {str(item.id): item.name for item in inventory_items}

        # Create purchase order
        po = PurchaseOrder(
            id=uuid.uuid4(),
            organization_id=organization_id,
            po_number=po_number,
            supplier_name=data.supplier_name,
            status="ordered",
            ordered_at=datetime.utcnow(),
            ordered_by_user_id=user_id,
            expected_delivery_date=data.expected_delivery_date,
            notes=data.notes,
            total_items=len(data.items),
            received_items=0,
        )
        self.db.add(po)
        await self.db.flush()

        # Create purchase order items
        for item_data in data.items:
            po_item = PurchaseOrderItem(
                id=uuid.uuid4(),
                purchase_order_id=po.id,
                inventory_item_id=item_data.inventory_item_id,
                quantity_ordered=item_data.quantity_ordered,
                quantity_received=Decimal("0"),
                unit_price=item_data.unit_price,
                notes=item_data.notes,
            )
            self.db.add(po_item)

        await self.db.flush()

        # Log audit entry
        await self.audit.log_action(
            organization_id=organization_id,
            actor_user_id=user_id,
            action="create",
            entity_type="purchase_order",
            entity_id=po.id,
            after={
                "po_number": po_number,
                "supplier_name": data.supplier_name,
                "status": "ordered",
                "total_items": len(data.items),
            },
        )

        return po

    async def get_purchase_order(
        self,
        po_id: uuid.UUID,
        organization_id: uuid.UUID,
    ) -> Optional[PurchaseOrder]:
        """Get a purchase order by ID with items."""
        stmt = (
            select(PurchaseOrder)
            .where(
                and_(
                    PurchaseOrder.id == po_id,
                    PurchaseOrder.organization_id == organization_id,
                )
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def receive_purchase_order(
        self,
        po_id: uuid.UUID,
        organization_id: uuid.UUID,
        user_id: uuid.UUID,
        receive_data: ReceivePurchaseOrder,
    ) -> PurchaseOrder:
        """Receive goods from a purchase order.

        This is an atomic transaction that:
        1. Creates/updates inventory lots
        2. Records inventory transactions (type='purchase')
        3. Updates purchase_order_items.quantity_received
        4. Updates purchase_order status (partially_received/received)
        """
        # Get purchase order
        po = await self.get_purchase_order(po_id, organization_id)
        if not po:
            raise ValueError(f"Purchase order not found: {po_id}")

        if po.status == "cancelled":
            raise ValueError("Cannot receive goods from a cancelled purchase order")

        if po.status == "received":
            raise ValueError("Purchase order has already been fully received")

        # Get all PO items
        po_items_stmt = select(PurchaseOrderItem).where(
            PurchaseOrderItem.purchase_order_id == po_id
        )
        po_items_result = await self.db.execute(po_items_stmt)
        po_items_map = {str(item.id): item for item in po_items_result.scalars().all()}

        # Process each received item
        for receive_item in receive_data.items:
            po_item = po_items_map.get(str(receive_item.item_id))
            if not po_item:
                raise ValueError(f"Purchase order item not found: {receive_item.item_id}")

            # Validate quantity
            remaining_qty = po_item.quantity_ordered - po_item.quantity_received
            if receive_item.quantity_received > remaining_qty:
                raise ValueError(
                    f"Cannot receive {receive_item.quantity_received} units. "
                    f"Only {remaining_qty} units remaining for this item."
                )

            # Find or create inventory lot if lot number provided
            lot_id = None
            if receive_item.lot_number:
                lot = await self._get_or_create_lot(
                    organization_id=organization_id,
                    item_id=po_item.inventory_item_id,
                    lot_number=receive_item.lot_number,
                    expires_at=receive_item.expiration_date,
                )
                lot_id = lot.id

            # Record inventory transaction (purchase)
            await self.inventory_service.record_transaction(
                organization_id=organization_id,
                item_id=po_item.inventory_item_id,
                lot_id=lot_id,
                reason=TransactionReason.PURCHASE,
                quantity=float(receive_item.quantity_received),
                note=receive_item.notes or f"Received from PO {po.po_number}",
                related_entity_type="purchase_order",
                related_entity_id=po_id,
                user_id=user_id,
            )

            # Update PO item quantity_received
            po_item.quantity_received += receive_item.quantity_received
            po_item.updated_at = datetime.utcnow()

        # Update PO status based on received items
        fully_received_count = sum(
            1
            for item in po_items_map.values()
            if item.quantity_received >= item.quantity_ordered
        )

        po.received_items = fully_received_count

        if fully_received_count == po.total_items:
            po.status = "received"
        elif fully_received_count > 0 or any(
            item.quantity_received > 0 for item in po_items_map.values()
        ):
            po.status = "partially_received"

        po.updated_at = datetime.utcnow()

        await self.db.flush()

        # Log audit entry
        await self.audit.log_action(
            organization_id=organization_id,
            actor_user_id=user_id,
            action="update",
            entity_type="purchase_order",
            entity_id=po.id,
            after={
                "status": po.status,
                "received_items": po.received_items,
                "action": "receive_goods",
            },
        )

        return po

    async def cancel_purchase_order(
        self,
        po_id: uuid.UUID,
        organization_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> PurchaseOrder:
        """Cancel a purchase order.

        Can only cancel if no goods have been received yet.
        """
        po = await self.get_purchase_order(po_id, organization_id)
        if not po:
            raise ValueError(f"Purchase order not found: {po_id}")

        if po.status == "cancelled":
            raise ValueError("Purchase order is already cancelled")

        # Check if any items have been received
        if po.received_items > 0:
            raise ValueError(
                "Cannot cancel purchase order with received items. "
                f"{po.received_items} of {po.total_items} items have been received."
            )

        # Check if any items have partial quantities received
        po_items_stmt = select(PurchaseOrderItem).where(
            PurchaseOrderItem.purchase_order_id == po_id
        )
        po_items_result = await self.db.execute(po_items_stmt)
        po_items = po_items_result.scalars().all()

        if any(item.quantity_received > 0 for item in po_items):
            raise ValueError("Cannot cancel purchase order with partially received items")

        po.status = "cancelled"
        po.updated_at = datetime.utcnow()

        await self.db.flush()

        # Log audit entry
        await self.audit.log_action(
            organization_id=organization_id,
            actor_user_id=user_id,
            action="update",
            entity_type="purchase_order",
            entity_id=po.id,
            after={"status": "cancelled"},
        )

        return po

    async def get_on_the_way_quantity(
        self,
        item_id: uuid.UUID,
        organization_id: uuid.UUID,
    ) -> Dict[str, Any]:
        """Calculate the total quantity on the way for an inventory item.

        Returns the sum of (quantity_ordered - quantity_received) across all
        non-cancelled purchase orders.
        """
        # Query all purchase order items for this inventory item
        stmt = (
            select(
                PurchaseOrderItem,
                PurchaseOrder.po_number,
                PurchaseOrder.expected_delivery_date,
                PurchaseOrder.status,
            )
            .join(PurchaseOrder, PurchaseOrderItem.purchase_order_id == PurchaseOrder.id)
            .where(
                and_(
                    PurchaseOrderItem.inventory_item_id == item_id,
                    PurchaseOrder.organization_id == organization_id,
                    PurchaseOrder.status.in_(["ordered", "partially_received"]),
                )
            )
        )
        result = await self.db.execute(stmt)
        rows = result.all()

        total_on_the_way = Decimal("0")
        purchase_orders = []

        for po_item, po_number, expected_delivery, status in rows:
            quantity_remaining = po_item.quantity_ordered - po_item.quantity_received
            if quantity_remaining > 0:
                total_on_the_way += quantity_remaining
                purchase_orders.append({
                    "po_number": po_number,
                    "quantity_remaining": float(quantity_remaining),
                    "expected_delivery_date": expected_delivery.isoformat() if expected_delivery else None,
                    "status": status,
                })

        return {
            "inventory_item_id": str(item_id),
            "quantity_on_the_way": float(total_on_the_way),
            "purchase_orders": purchase_orders,
        }

    async def _get_or_create_lot(
        self,
        organization_id: uuid.UUID,
        item_id: uuid.UUID,
        lot_number: str,
        expires_at: Optional[Any] = None,
    ) -> InventoryLot:
        """Get existing lot by number or create a new one."""
        # Try to find existing lot
        stmt = select(InventoryLot).where(
            and_(
                InventoryLot.organization_id == organization_id,
                InventoryLot.item_id == item_id,
                InventoryLot.lot_number == lot_number,
            )
        )
        result = await self.db.execute(stmt)
        lot = result.scalar_one_or_none()

        if lot:
            # Update expiration date if provided and lot doesn't have one
            if expires_at and not lot.expires_at:
                lot.expires_at = expires_at
                lot.updated_at = datetime.utcnow()
            return lot

        # Create new lot
        lot = InventoryLot(
            id=uuid.uuid4(),
            organization_id=organization_id,
            item_id=item_id,
            lot_number=lot_number,
            expires_at=expires_at,
            quantity=Decimal("0"),  # Will be updated by transaction
        )
        self.db.add(lot)
        await self.db.flush()

        return lot
