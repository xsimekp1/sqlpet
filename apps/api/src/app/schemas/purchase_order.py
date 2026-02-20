"""Pydantic schemas for purchase order endpoints."""

from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional, List
from decimal import Decimal
import uuid


# Purchase Order Item schemas
class PurchaseOrderItemCreate(BaseModel):
    """Schema for creating a purchase order item."""
    inventory_item_id: uuid.UUID
    quantity_ordered: Decimal = Field(..., gt=0, decimal_places=2)
    unit_price: Optional[Decimal] = Field(None, decimal_places=2)
    notes: Optional[str] = None


class PurchaseOrderItemResponse(BaseModel):
    """Schema for purchase order item response."""
    id: uuid.UUID
    purchase_order_id: uuid.UUID
    inventory_item_id: uuid.UUID
    inventory_item_name: str
    quantity_ordered: Decimal
    quantity_received: Decimal
    unit_price: Optional[Decimal]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Purchase Order schemas
class PurchaseOrderCreate(BaseModel):
    """Schema for creating a purchase order."""
    supplier_name: str = Field(..., min_length=1, max_length=255)
    items: List[PurchaseOrderItemCreate] = Field(..., min_items=1)
    expected_delivery_date: Optional[date] = None
    notes: Optional[str] = None


class PurchaseOrderResponse(BaseModel):
    """Schema for purchase order response."""
    id: uuid.UUID
    organization_id: uuid.UUID
    po_number: str
    supplier_name: str
    status: str  # ordered, partially_received, received, cancelled
    ordered_at: datetime
    ordered_by_user_id: Optional[uuid.UUID]
    expected_delivery_date: Optional[date]
    notes: Optional[str]
    total_items: int
    received_items: int
    items: List[PurchaseOrderItemResponse]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PurchaseOrderListResponse(BaseModel):
    """Schema for purchase order list response (without items)."""
    id: uuid.UUID
    organization_id: uuid.UUID
    po_number: str
    supplier_name: str
    status: str
    ordered_at: datetime
    expected_delivery_date: Optional[date]
    total_items: int
    received_items: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Receive Purchase Order schemas
class ReceivePurchaseOrderItem(BaseModel):
    """Schema for receiving a purchase order item."""
    item_id: uuid.UUID
    quantity_received: Decimal = Field(..., gt=0, decimal_places=2)
    lot_number: Optional[str] = Field(None, max_length=100)
    expiration_date: Optional[date] = None
    notes: Optional[str] = None


class ReceivePurchaseOrder(BaseModel):
    """Schema for receiving goods from a purchase order."""
    items: List[ReceivePurchaseOrderItem] = Field(..., min_items=1)


# On-the-way quantity response
class OnTheWayResponse(BaseModel):
    """Schema for on-the-way quantity response."""
    inventory_item_id: uuid.UUID
    quantity_on_the_way: Decimal
    purchase_orders: List[dict]  # [{po_number, quantity_remaining, expected_delivery_date}]
