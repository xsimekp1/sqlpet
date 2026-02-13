"""Inventory item model for tracking supplies."""

import enum
import uuid

from sqlalchemy import String, Numeric, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from src.app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class InventoryCategory(str, enum.Enum):
    MEDICATION = "medication"
    VACCINE = "vaccine"
    FOOD = "food"
    SUPPLY = "supply"
    OTHER = "other"


class InventoryItem(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "inventory_items"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[InventoryCategory] = mapped_column(
        Enum(
            InventoryCategory,
            name="inventory_category_enum",
            create_constraint=False,
            native_enum=False,
            values_callable=lambda x: [e.value for e in x]
        ),
        nullable=False,
    )
    unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    reorder_threshold: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    # Food-specific fields (relevant when category == 'food')
    kcal_per_100g: Mapped[float | None] = mapped_column(Numeric(7, 2), nullable=True)
    price_per_unit: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    allowed_species: Mapped[list | None] = mapped_column(JSONB, nullable=True)  # e.g. ["dog", "cat"]
