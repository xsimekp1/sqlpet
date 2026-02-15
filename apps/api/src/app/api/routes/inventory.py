"""API routes for inventory management."""

import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List

from src.app.api.dependencies.auth import get_current_user, get_current_organization_id
from src.app.api.dependencies.db import get_db
from src.app.models.user import User
from src.app.models.inventory_item import InventoryCategory
from src.app.models.inventory_transaction import TransactionType
from src.app.schemas.inventory import (
    InventoryItemCreate,
    InventoryItemUpdate,
    InventoryItemResponse,
    InventoryLotCreate,
    InventoryLotUpdate,
    InventoryLotResponse,
    InventoryTransactionCreate,
    InventoryTransactionResponse,
    InventoryStockResponse,
)
from src.app.services.inventory_service import InventoryService

router = APIRouter(prefix="/inventory", tags=["inventory"])


# Inventory Item endpoints
@router.post("/items", response_model=InventoryItemResponse, status_code=status.HTTP_201_CREATED)
async def create_inventory_item(
    item_data: InventoryItemCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Create a new inventory item."""
    print(f"DEBUG create_inventory_item: user={current_user.id}, org={organization_id}, data={item_data}")
    inventory_service = InventoryService(db)

    try:
        category = InventoryCategory(item_data.category)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid category: {item_data.category}",
        )

    item = await inventory_service.create_item(
        organization_id=organization_id,
        name=item_data.name,
        category=category,
        created_by_id=current_user.id,
        unit=item_data.unit,
        reorder_threshold=item_data.reorder_threshold,
        kcal_per_100g=item_data.kcal_per_100g,
        price_per_unit=item_data.price_per_unit,
        allowed_species=item_data.allowed_species,
        food_type=item_data.food_type,
        shelf_life_days=item_data.shelf_life_days,
        unit_weight_g=item_data.unit_weight_g,
    )
    await db.commit()
    return item


@router.get("/items", response_model=List[InventoryStockResponse])
async def list_inventory_items(
    category: Optional[str] = Query(None, description="Filter by category"),
    low_stock_only: bool = Query(False, description="Show only low stock items"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """List inventory items with stock information."""
    print(f"DEBUG list_inventory: org={organization_id}, category={category}, low_stock={low_stock_only}")
    inventory_service = InventoryService(db)

    category_enum = None
    if category:
        try:
            category_enum = InventoryCategory(category)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid category: {category}",
            )

    items = await inventory_service.get_items_with_stock(
        organization_id=organization_id,
        category=category_enum,
        low_stock_only=low_stock_only,
    )

    return items


@router.get("/items/{item_id}", response_model=InventoryItemResponse)
async def get_inventory_item(
    item_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Get a single inventory item by ID."""
    inventory_service = InventoryService(db)
    item = await inventory_service.get_item_by_id(item_id, organization_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    return item


@router.put("/items/{item_id}", response_model=InventoryItemResponse)
async def update_inventory_item(
    item_id: uuid.UUID,
    item_data: InventoryItemUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Update an inventory item."""
    inventory_service = InventoryService(db)

    try:
        updates = {k: v for k, v in item_data.dict().items() if v is not None}
        item = await inventory_service.update_item(
            item_id=item_id,
            organization_id=organization_id,
            user_id=current_user.id,
            **updates,
        )
        await db.commit()
        return item
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_inventory_item(
    item_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Delete an inventory item if it has no active lots with quantity > 0."""
    from sqlalchemy import select, and_
    from src.app.models.inventory_item import InventoryItem
    from src.app.models.inventory_lot import InventoryLot

    item = (await db.execute(
        select(InventoryItem).where(
            InventoryItem.id == item_id,
            InventoryItem.organization_id == organization_id,
        )
    )).scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    active_lots = (await db.execute(
        select(InventoryLot).where(
            InventoryLot.item_id == item_id,
            InventoryLot.quantity > 0,
        )
    )).scalars().first()
    if active_lots:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete item with active stock. Deplete all lots first.",
        )

    await db.delete(item)
    await db.commit()


# Inventory Lot endpoints
@router.post("/lots", response_model=InventoryLotResponse, status_code=status.HTTP_201_CREATED)
async def create_inventory_lot(
    lot_data: InventoryLotCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Create a new inventory lot."""
    inventory_service = InventoryService(db)

    try:
        lot = await inventory_service.create_lot(
            organization_id=organization_id,
            item_id=lot_data.item_id,
            quantity=lot_data.quantity,
            created_by_id=current_user.id,
            lot_number=lot_data.lot_number,
            expires_at=lot_data.expires_at,
            cost_per_unit=lot_data.cost_per_unit,
        )
        await db.commit()
        return lot
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.get("/lots", response_model=List[InventoryLotResponse])
async def list_inventory_lots(
    item_id: Optional[uuid.UUID] = Query(None, description="Filter by item"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """List inventory lots."""
    from sqlalchemy import select, and_
    from src.app.models.inventory_lot import InventoryLot

    conditions = [InventoryLot.organization_id == organization_id]
    if item_id:
        conditions.append(InventoryLot.item_id == item_id)

    stmt = (
        select(InventoryLot)
        .where(and_(*conditions))
        .order_by(InventoryLot.expires_at.asc().nullslast())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.put("/lots/{lot_id}", response_model=InventoryLotResponse)
async def update_inventory_lot(
    lot_id: uuid.UUID,
    lot_data: InventoryLotUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Update an inventory lot."""
    inventory_service = InventoryService(db)

    try:
        updates = {k: v for k, v in lot_data.dict().items() if v is not None}
        lot = await inventory_service.update_lot(
            lot_id=lot_id,
            organization_id=organization_id,
            user_id=current_user.id,
            **updates,
        )
        await db.commit()
        return lot
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


# Inventory Transaction endpoints
@router.post("/transactions", response_model=InventoryTransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_inventory_transaction(
    transaction_data: InventoryTransactionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Record an inventory transaction."""
    inventory_service = InventoryService(db)

    try:
        transaction_type = TransactionType(transaction_data.type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid transaction type: {transaction_data.type}",
        )

    transaction = await inventory_service.record_transaction(
        organization_id=organization_id,
        item_id=transaction_data.item_id,
        transaction_type=transaction_type,
        quantity=transaction_data.quantity,
        reason=transaction_data.reason,
        lot_id=transaction_data.lot_id,
        related_entity_type=transaction_data.related_entity_type,
        related_entity_id=transaction_data.related_entity_id,
        user_id=current_user.id,
    )
    await db.commit()
    return transaction


@router.get("/transactions", response_model=List[InventoryTransactionResponse])
async def list_inventory_transactions(
    item_id: Optional[uuid.UUID] = Query(None, description="Filter by item"),
    days: int = Query(90, ge=1, le=365, description="Days of history"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """List inventory transactions."""
    inventory_service = InventoryService(db)

    transactions = await inventory_service.get_transaction_history(
        organization_id=organization_id,
        item_id=item_id,
        days=days,
    )
    return transactions


# Low stock alert endpoint (for MVP simplification - optional)
@router.get("/low-stock", response_model=List[InventoryStockResponse])
async def get_low_stock_items(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Get items below reorder threshold."""
    inventory_service = InventoryService(db)

    items = await inventory_service.get_items_with_stock(
        organization_id=organization_id,
        low_stock_only=True,
    )
    return items
