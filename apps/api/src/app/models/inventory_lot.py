"""Inventory lot model for tracking batches with expiry dates."""

import uuid
from datetime import date

from sqlalchemy import String, Date, Numeric, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class InventoryLot(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "inventory_lots"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("inventory_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    lot_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    expires_at: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    quantity: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    cost_per_unit: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
