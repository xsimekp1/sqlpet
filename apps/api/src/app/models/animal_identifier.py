import enum
import uuid
from datetime import date

from sqlalchemy import Date, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class IdentifierType(str, enum.Enum):
    MICROCHIP = "microchip"
    TATTOO = "tattoo"
    COLLAR_TAG = "collar_tag"
    OTHER = "other"


class AnimalIdentifier(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "animal_identifiers"

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
    type: Mapped[IdentifierType] = mapped_column(
        Enum(IdentifierType, name="identifier_type_enum", create_constraint=False, native_enum=True),
        nullable=False,
    )
    value: Mapped[str] = mapped_column(String(255), nullable=False)
    registry: Mapped[str | None] = mapped_column(Text, nullable=True)
    issued_at: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Relationships
    animal = relationship("Animal", back_populates="identifiers")
