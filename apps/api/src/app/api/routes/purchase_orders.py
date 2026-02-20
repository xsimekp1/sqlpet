"""API routes for purchase order management."""

import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from typing import Optional, List
from datetime import datetime, date

logger = logging.getLogger(__name__)

from src.app.api.dependencies.auth import (
    get_current_user,
    get_current_organization_id,
    require_permission,
)
from src.app.api.dependencies.db import get_db
from src.app.models.user import User
from src.app.models.purchase_order import PurchaseOrder, PurchaseOrderItem
from src.app.models.inventory_item import InventoryItem
from src.app.schemas.purchase_order import (
    PurchaseOrderCreate,
    PurchaseOrderResponse,
    PurchaseOrderListResponse,
    PurchaseOrderItemResponse,
    ReceivePurchaseOrder,
    OnTheWayResponse,
)
from src.app.services.purchase_service import PurchaseService

router = APIRouter(prefix="/purchase-orders", tags=["purchase_orders"])


@router.post(
    "",
    response_model=PurchaseOrderResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("inventory.write"))],
)
async def create_purchase_order(
    po_data: PurchaseOrderCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Create a new purchase order with status='ordered'.

    This implements Option B from the plan: directly create an ordered PO
    from shopping list items for fastest UX.
    """
    logger.info(
        f"Creating purchase order: user={current_user.id}, org={organization_id}, "
        f"supplier={po_data.supplier_name}, items={len(po_data.items)}"
    )

    purchase_service = PurchaseService(db)

    try:
        po = await purchase_service.create_purchase_order(
            organization_id=organization_id,
            user_id=current_user.id,
            data=po_data,
        )
        await db.commit()
        await db.refresh(po)

        # Load items with inventory item names
        items_stmt = (
            select(PurchaseOrderItem, InventoryItem.name)
            .join(InventoryItem, PurchaseOrderItem.inventory_item_id == InventoryItem.id)
            .where(PurchaseOrderItem.purchase_order_id == po.id)
        )
        items_result = await db.execute(items_stmt)
        items_data = items_result.all()

        # Build response with item names
        items_response = [
            PurchaseOrderItemResponse(
                id=item.id,
                purchase_order_id=item.purchase_order_id,
                inventory_item_id=item.inventory_item_id,
                inventory_item_name=item_name,
                quantity_ordered=item.quantity_ordered,
                quantity_received=item.quantity_received,
                unit_price=item.unit_price,
                notes=item.notes,
                created_at=item.created_at,
                updated_at=item.updated_at,
            )
            for item, item_name in items_data
        ]

        return PurchaseOrderResponse(
            id=po.id,
            organization_id=po.organization_id,
            po_number=po.po_number,
            supplier_name=po.supplier_name,
            status=po.status,
            ordered_at=po.ordered_at,
            ordered_by_user_id=po.ordered_by_user_id,
            expected_delivery_date=po.expected_delivery_date,
            notes=po.notes,
            total_items=po.total_items,
            received_items=po.received_items,
            items=items_response,
            created_at=po.created_at,
            updated_at=po.updated_at,
        )

    except ValueError as e:
        logger.error(f"Validation error creating purchase order: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating purchase order: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create purchase order",
        )


@router.get(
    "",
    response_model=List[PurchaseOrderListResponse],
    dependencies=[Depends(require_permission("inventory.read"))],
)
async def list_purchase_orders(
    status_filter: Optional[str] = Query(None, description="Filter by status"),
    date_from: Optional[date] = Query(None, description="Filter by ordered_at >= date_from"),
    date_to: Optional[date] = Query(None, description="Filter by ordered_at <= date_to"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """List purchase orders with optional filters."""
    logger.info(
        f"Listing purchase orders: org={organization_id}, status={status_filter}, "
        f"date_from={date_from}, date_to={date_to}, page={page}"
    )

    # Build query
    conditions = [PurchaseOrder.organization_id == organization_id]

    if status_filter:
        if status_filter not in ["ordered", "partially_received", "received", "cancelled"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status filter: {status_filter}",
            )
        conditions.append(PurchaseOrder.status == status_filter)

    if date_from:
        conditions.append(PurchaseOrder.ordered_at >= datetime.combine(date_from, datetime.min.time()))

    if date_to:
        conditions.append(PurchaseOrder.ordered_at <= datetime.combine(date_to, datetime.max.time()))

    stmt = (
        select(PurchaseOrder)
        .where(and_(*conditions))
        .order_by(PurchaseOrder.ordered_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    result = await db.execute(stmt)
    purchase_orders = result.scalars().all()

    return [
        PurchaseOrderListResponse(
            id=po.id,
            organization_id=po.organization_id,
            po_number=po.po_number,
            supplier_name=po.supplier_name,
            status=po.status,
            ordered_at=po.ordered_at,
            expected_delivery_date=po.expected_delivery_date,
            total_items=po.total_items,
            received_items=po.received_items,
            created_at=po.created_at,
            updated_at=po.updated_at,
        )
        for po in purchase_orders
    ]


@router.get(
    "/{po_id}",
    response_model=PurchaseOrderResponse,
    dependencies=[Depends(require_permission("inventory.read"))],
)
async def get_purchase_order(
    po_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Get a purchase order by ID with all items."""
    logger.info(f"Getting purchase order: id={po_id}, org={organization_id}")

    purchase_service = PurchaseService(db)
    po = await purchase_service.get_purchase_order(po_id, organization_id)

    if not po:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Purchase order not found: {po_id}",
        )

    # Load items with inventory item names
    items_stmt = (
        select(PurchaseOrderItem, InventoryItem.name)
        .join(InventoryItem, PurchaseOrderItem.inventory_item_id == InventoryItem.id)
        .where(PurchaseOrderItem.purchase_order_id == po.id)
    )
    items_result = await db.execute(items_stmt)
    items_data = items_result.all()

    # Build response with item names
    items_response = [
        PurchaseOrderItemResponse(
            id=item.id,
            purchase_order_id=item.purchase_order_id,
            inventory_item_id=item.inventory_item_id,
            inventory_item_name=item_name,
            quantity_ordered=item.quantity_ordered,
            quantity_received=item.quantity_received,
            unit_price=item.unit_price,
            notes=item.notes,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )
        for item, item_name in items_data
    ]

    return PurchaseOrderResponse(
        id=po.id,
        organization_id=po.organization_id,
        po_number=po.po_number,
        supplier_name=po.supplier_name,
        status=po.status,
        ordered_at=po.ordered_at,
        ordered_by_user_id=po.ordered_by_user_id,
        expected_delivery_date=po.expected_delivery_date,
        notes=po.notes,
        total_items=po.total_items,
        received_items=po.received_items,
        items=items_response,
        created_at=po.created_at,
        updated_at=po.updated_at,
    )


@router.post(
    "/{po_id}/receive",
    response_model=PurchaseOrderResponse,
    dependencies=[Depends(require_permission("inventory.write"))],
)
async def receive_purchase_order(
    po_id: uuid.UUID,
    receive_data: ReceivePurchaseOrder,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Receive goods from a purchase order.

    This is an atomic transaction that updates inventory, lots, and PO status.
    """
    logger.info(
        f"Receiving purchase order: id={po_id}, org={organization_id}, "
        f"items={len(receive_data.items)}"
    )

    purchase_service = PurchaseService(db)

    try:
        po = await purchase_service.receive_purchase_order(
            po_id=po_id,
            organization_id=organization_id,
            user_id=current_user.id,
            receive_data=receive_data,
        )
        await db.commit()
        await db.refresh(po)

        # Load items with inventory item names
        items_stmt = (
            select(PurchaseOrderItem, InventoryItem.name)
            .join(InventoryItem, PurchaseOrderItem.inventory_item_id == InventoryItem.id)
            .where(PurchaseOrderItem.purchase_order_id == po.id)
        )
        items_result = await db.execute(items_stmt)
        items_data = items_result.all()

        # Build response with item names
        items_response = [
            PurchaseOrderItemResponse(
                id=item.id,
                purchase_order_id=item.purchase_order_id,
                inventory_item_id=item.inventory_item_id,
                inventory_item_name=item_name,
                quantity_ordered=item.quantity_ordered,
                quantity_received=item.quantity_received,
                unit_price=item.unit_price,
                notes=item.notes,
                created_at=item.created_at,
                updated_at=item.updated_at,
            )
            for item, item_name in items_data
        ]

        return PurchaseOrderResponse(
            id=po.id,
            organization_id=po.organization_id,
            po_number=po.po_number,
            supplier_name=po.supplier_name,
            status=po.status,
            ordered_at=po.ordered_at,
            ordered_by_user_id=po.ordered_by_user_id,
            expected_delivery_date=po.expected_delivery_date,
            notes=po.notes,
            total_items=po.total_items,
            received_items=po.received_items,
            items=items_response,
            created_at=po.created_at,
            updated_at=po.updated_at,
        )

    except ValueError as e:
        logger.error(f"Validation error receiving purchase order: {e}")
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error receiving purchase order: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to receive purchase order",
        )


@router.patch(
    "/{po_id}/cancel",
    response_model=PurchaseOrderResponse,
    dependencies=[Depends(require_permission("inventory.write"))],
)
async def cancel_purchase_order(
    po_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Cancel a purchase order.

    Can only cancel if no goods have been received yet.
    """
    logger.info(f"Cancelling purchase order: id={po_id}, org={organization_id}")

    purchase_service = PurchaseService(db)

    try:
        po = await purchase_service.cancel_purchase_order(
            po_id=po_id,
            organization_id=organization_id,
            user_id=current_user.id,
        )
        await db.commit()
        await db.refresh(po)

        # Load items with inventory item names
        items_stmt = (
            select(PurchaseOrderItem, InventoryItem.name)
            .join(InventoryItem, PurchaseOrderItem.inventory_item_id == InventoryItem.id)
            .where(PurchaseOrderItem.purchase_order_id == po.id)
        )
        items_result = await db.execute(items_stmt)
        items_data = items_result.all()

        # Build response with item names
        items_response = [
            PurchaseOrderItemResponse(
                id=item.id,
                purchase_order_id=item.purchase_order_id,
                inventory_item_id=item.inventory_item_id,
                inventory_item_name=item_name,
                quantity_ordered=item.quantity_ordered,
                quantity_received=item.quantity_received,
                unit_price=item.unit_price,
                notes=item.notes,
                created_at=item.created_at,
                updated_at=item.updated_at,
            )
            for item, item_name in items_data
        ]

        return PurchaseOrderResponse(
            id=po.id,
            organization_id=po.organization_id,
            po_number=po.po_number,
            supplier_name=po.supplier_name,
            status=po.status,
            ordered_at=po.ordered_at,
            ordered_by_user_id=po.ordered_by_user_id,
            expected_delivery_date=po.expected_delivery_date,
            notes=po.notes,
            total_items=po.total_items,
            received_items=po.received_items,
            items=items_response,
            created_at=po.created_at,
            updated_at=po.updated_at,
        )

    except ValueError as e:
        logger.error(f"Validation error cancelling purchase order: {e}")
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error cancelling purchase order: {e}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel purchase order",
        )


@router.get(
    "/items/{item_id}/on-the-way",
    response_model=OnTheWayResponse,
    dependencies=[Depends(require_permission("inventory.read"))],
)
async def get_on_the_way_quantity(
    item_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Get the quantity on the way for an inventory item.

    Returns the sum of ordered but not yet received quantities across all
    non-cancelled purchase orders.
    """
    logger.info(f"Getting on-the-way quantity: item_id={item_id}, org={organization_id}")

    # Verify item exists and belongs to organization
    item_stmt = select(InventoryItem).where(
        and_(
            InventoryItem.id == item_id,
            InventoryItem.organization_id == organization_id,
        )
    )
    item_result = await db.execute(item_stmt)
    item = item_result.scalar_one_or_none()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Inventory item not found: {item_id}",
        )

    purchase_service = PurchaseService(db)
    on_the_way_data = await purchase_service.get_on_the_way_quantity(
        item_id=item_id,
        organization_id=organization_id,
    )

    return OnTheWayResponse(**on_the_way_data)
