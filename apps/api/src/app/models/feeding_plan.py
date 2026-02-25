"""Feeding plan model for scheduling animal feeding."""

import uuid
from datetime import date

from sqlalchemy import String, Text, Integer, Date, Boolean, Numeric, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class FeedingPlan(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "feeding_plans"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    animal_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("animals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    food_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("foods.id", ondelete="SET NULL"),
        nullable=True,
    )
    inventory_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("inventory_items.id", ondelete="SET NULL"),
        nullable=True,
    )
    amount_g: Mapped[float | None] = mapped_column(Numeric(8, 2), nullable=True)
    amount_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    times_per_day: Mapped[int | None] = mapped_column(Integer, nullable=True)
    schedule_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    mer_calculation: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    animal = relationship("Animal")
    food = relationship("Food")
    inventory_item = relationship("InventoryItem")
