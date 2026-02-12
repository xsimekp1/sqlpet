"""Food model for animal feeding management."""

import enum
import uuid

from sqlalchemy import String, Numeric, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class FoodType(str, enum.Enum):
    DRY = "dry"
    WET = "wet"
    RAW = "raw"
    MEDICAL = "medical"
    OTHER = "other"


class Food(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "foods"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    brand: Mapped[str | None] = mapped_column(String(255), nullable=True)
    type: Mapped[FoodType] = mapped_column(
        Enum(
            FoodType,
            name="food_type_enum",
            create_constraint=False,
            native_enum=False,
            values_callable=lambda x: [e.value for e in x]
        ),
        nullable=False,
    )
    kcal_per_100g: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
