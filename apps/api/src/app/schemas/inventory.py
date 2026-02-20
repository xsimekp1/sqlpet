"""Pydantic schemas for inventory endpoints."""

from enum import Enum
from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional, Dict, Any
import uuid

from src.app.models.inventory_transaction import (
    TransactionReason as ModelTransactionReason,
    TransactionType as ModelTransactionType,
)
from src.app.models.inventory_item import InventoryCategory


# Inventory Item schemas
class InventoryItemBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category: str  # medication, vaccine, food, supply, other
    unit: Optional[str] = Field(None, max_length=50)
    reorder_threshold: Optional[float] = None
    # Food-specific fields
    kcal_per_100g: Optional[float] = None
    price_per_unit: Optional[float] = None
    allowed_species: Optional[list[str]] = None  # e.g. ["dog", "cat"]
    food_type: Optional[str] = None  # dry, wet, canned, treats, raw, other
    shelf_life_days: Optional[int] = None  # shelf life after opening in days
    unit_weight_g: Optional[int] = None  # package weight in grams


class InventoryItemCreate(InventoryItemBase):
    pass


class InventoryItemUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    category: Optional[str] = None
    unit: Optional[str] = Field(None, max_length=50)
    reorder_threshold: Optional[float] = None
    kcal_per_100g: Optional[float] = None
    price_per_unit: Optional[float] = None
    allowed_species: Optional[list[str]] = None
    food_type: Optional[str] = None
    shelf_life_days: Optional[int] = None
    unit_weight_g: Optional[int] = None


class InventoryItemResponse(InventoryItemBase):
    id: uuid.UUID
    organization_id: uuid.UUID
    quantity_current: float = 0  # Cached current quantity
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Re-export for API use
TransactionDirection = ModelTransactionType
TransactionReason = ModelTransactionReason


# Reason to direction mapping
REASON_TO_DIRECTION = {
    TransactionReason.OPENING_BALANCE: TransactionDirection.IN,
    TransactionReason.PURCHASE: TransactionDirection.IN,
    TransactionReason.DONATION: TransactionDirection.IN,
    TransactionReason.CONSUMPTION: TransactionDirection.OUT,
    TransactionReason.WRITEOFF: TransactionDirection.OUT,
}


class InventoryTransactionCreate(BaseModel):
    item_id: uuid.UUID
    lot_id: Optional[uuid.UUID] = None
    reason: (
        TransactionReason  # opening_balance, purchase, donation, consumption, writeoff
    )
    quantity: float = Field(..., gt=0)
    note: Optional[str] = None
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[uuid.UUID] = None


class InventoryTransactionResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    item_id: uuid.UUID
    lot_id: Optional[uuid.UUID]
    direction: str  # in, out, adjust
    reason: str  # opening_balance, purchase, donation, consumption, writeoff
    quantity: float
    note: Optional[str]
    related_entity_type: Optional[str]
    related_entity_id: Optional[uuid.UUID]
    created_by_user_id: Optional[uuid.UUID]
    created_at: datetime

    class Config:
        from_attributes = True


# Stock information response
class InventoryStockResponse(BaseModel):
    item: InventoryItemResponse
    total_quantity: float
    quantity_current: float  # From item cache
    lots_count: int
    oldest_expiry: Optional[date]

    class Config:
        from_attributes = True


# Inventory Lot schemas
class InventoryLotBase(BaseModel):
    item_id: uuid.UUID
    lot_number: Optional[str] = Field(None, max_length=100)
    expires_at: Optional[date] = None
    quantity: float
    cost_per_unit: Optional[float] = None


class InventoryLotCreate(InventoryLotBase):
    pass


class InventoryLotUpdate(BaseModel):
    quantity: Optional[float] = None
    expires_at: Optional[date] = None
    cost_per_unit: Optional[float] = None


class InventoryLotResponse(InventoryLotBase):
    id: uuid.UUID
    organization_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
