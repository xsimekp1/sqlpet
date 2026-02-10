import enum

from sqlalchemy import Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from src.app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin


class Species(str, enum.Enum):
    DOG = "dog"
    CAT = "cat"
    RABBIT = "rabbit"
    BIRD = "bird"
    OTHER = "other"


class Sex(str, enum.Enum):
    MALE = "male"
    FEMALE = "female"
    UNKNOWN = "unknown"


class AnimalStatus(str, enum.Enum):
    INTAKE = "intake"
    AVAILABLE = "available"
    RESERVED = "reserved"
    ADOPTED = "adopted"
    FOSTERED = "fostered"
    RETURNED = "returned"
    DECEASED = "deceased"
    TRANSFERRED = "transferred"


class Animal(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "animals"

    organization_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    public_code: Mapped[str | None] = mapped_column(String(50), unique=True, nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    species: Mapped[Species] = mapped_column(
        Enum(Species, name="species_enum", create_constraint=False, native_enum=True),
        nullable=False,
    )
    sex: Mapped[Sex] = mapped_column(
        Enum(Sex, name="sex_enum", create_constraint=False, native_enum=True),
        default=Sex.UNKNOWN,
    )
    status: Mapped[AnimalStatus] = mapped_column(
        Enum(AnimalStatus, name="animal_status_enum", create_constraint=False, native_enum=True),
        default=AnimalStatus.INTAKE,
    )
