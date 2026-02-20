"""Purchase Order models."""
from sqlalchemy import Column, String, Integer, DateTime, Date, Text, ForeignKey, Numeric, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from src.app.db.base import Base


class PurchaseOrder(Base):
    """Purchase order model for tracking supplier orders."""

    __tablename__ = "purchase_orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    po_number = Column(String(50), nullable=False)
    supplier_name = Column(String(255), nullable=False)
    status = Column(String(20), nullable=False, default="ordered")
    ordered_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    ordered_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    expected_delivery_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    total_items = Column(Integer, nullable=False, default=0)
    received_items = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    organization = relationship("Organization")
    ordered_by = relationship("User")
    items = relationship("PurchaseOrderItem", back_populates="purchase_order", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("status IN ('ordered', 'partially_received', 'received', 'cancelled')", name='check_po_status'),
    )


class PurchaseOrderItem(Base):
    """Purchase order item model for individual items in a purchase order."""

    __tablename__ = "purchase_order_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    purchase_order_id = Column(UUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False)
    inventory_item_id = Column(UUID(as_uuid=True), ForeignKey("inventory_items.id", ondelete="RESTRICT"), nullable=False)
    quantity_ordered = Column(Numeric(10, 2), nullable=False)
    quantity_received = Column(Numeric(10, 2), nullable=False, default=0)
    unit_price = Column(Numeric(10, 2), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    purchase_order = relationship("PurchaseOrder", back_populates="items")
    inventory_item = relationship("InventoryItem")

    __table_args__ = (
        CheckConstraint('quantity_ordered > 0', name='check_quantity_ordered_positive'),
        CheckConstraint('quantity_received >= 0', name='check_quantity_received_non_negative'),
    )
