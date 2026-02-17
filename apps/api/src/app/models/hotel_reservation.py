import uuid
from datetime import date
from enum import Enum

from sqlalchemy import Boolean, Date, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class HotelReservationStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class HotelReservation(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "hotel_reservations"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kennel_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("kennels.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contacts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    animal_name: Mapped[str] = mapped_column(String(255), nullable=False)
    animal_species: Mapped[str] = mapped_column(String(50), nullable=False)
    animal_breed: Mapped[str | None] = mapped_column(String(255), nullable=True)
    animal_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    animal_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("animals.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    reserved_from: Mapped[date] = mapped_column(Date, nullable=False)
    reserved_to: Mapped[date] = mapped_column(Date, nullable=False)

    price_per_day: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    total_price: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    is_paid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    requires_single_cage: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    status: Mapped[str] = mapped_column(
        String(50),
        default=HotelReservationStatus.PENDING.value,
        nullable=False,
    )

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    organization = relationship("Organization")
    kennel = relationship("Kennel")
    contact = relationship("Contact")
