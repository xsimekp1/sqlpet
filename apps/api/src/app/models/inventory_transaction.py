"""Inventory transaction model for tracking all inventory movements."""

import enum
import uuid

from sqlalchemy import String, Text, Numeric, Enum, ForeignKey, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class TransactionType(str, enum.Enum):
    IN = "in"
    OUT = "out"
    ADJUST = "adjust"


class InventoryTransaction(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "inventory_transactions"
    __table_args__ = (
        Index(
            "ix_inventory_transactions_related",
            "related_entity_type",
            "related_entity_id",
        ),
    )

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
    lot_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("inventory_lots.id", ondelete="SET NULL"),
        nullable=True,
    )
    type: Mapped[TransactionType] = mapped_column(
        Enum(
            TransactionType,
            name="inventory_transaction_type_enum",
            create_constraint=False,
            native_enum=False,
            values_callable=lambda x: [e.value for e in x]
        ),
        nullable=False,
    )
    quantity: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    related_entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    related_entity_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
