import uuid
from datetime import date
from enum import Enum

from sqlalchemy import Date, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin


class IntakeReason(str, Enum):
    FOUND = "found"
    RETURN = "return"
    SURRENDER = "surrender"
    OFFICIAL = "official"
    TRANSFER = "transfer"
    BIRTH = "birth"
    OTHER = "other"


class Intake(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "intakes"

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
    reason: Mapped[IntakeReason] = mapped_column(
        String(50),
        nullable=False,
    )
    intake_date: Mapped[date] = mapped_column(Date, nullable=False)

    # Finder (for FOUND)
    finder_person_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contacts.id", ondelete="SET NULL"),
        nullable=True,
    )
    finder_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Planned outcome
    planned_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    planned_outcome_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    actual_outcome_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    planned_person_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("contacts.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Funding
    funding_source: Mapped[str | None] = mapped_column(String(255), nullable=True)
    funding_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_by_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    # Relationships
    organization = relationship("Organization")
    animal = relationship("Animal")
    finder_person = relationship("Contact", foreign_keys=[finder_person_id])
    planned_person = relationship("Contact", foreign_keys=[planned_person_id])
    created_by = relationship("User")
