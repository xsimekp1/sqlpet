import uuid
from datetime import datetime, date

from sqlalchemy import DateTime, Date, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class AnimalVaccination(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "animal_vaccinations"

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
    vaccination_type: Mapped[str] = mapped_column(String(50), nullable=False)
    lot_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("inventory_lots.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    lot_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    administered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    administered_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    task_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="SET NULL"),
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)

    organization = relationship("Organization")
    animal = relationship("Animal")
    lot = relationship("InventoryLot")
    administered_by = relationship("User")
