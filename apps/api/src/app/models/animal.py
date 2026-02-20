import enum
import uuid
from datetime import date

from sqlalchemy import (
    Boolean,
    Date,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

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
    REGISTERED = "registered"
    INTAKE = "intake"
    AVAILABLE = "available"
    RESERVED = "reserved"
    ADOPTED = "adopted"
    FOSTERED = "fostered"
    RETURNED = "returned"
    DECEASED = "deceased"
    TRANSFERRED = "transferred"
    HOLD = "hold"
    QUARANTINE = "quarantine"
    RETURNED_TO_OWNER = "returned_to_owner"
    EUTHANIZED = "euthanized"
    ESCAPED = "escaped"
    HOTEL = "hotel"
    WITH_OWNER = "with_owner"


class AlteredStatus(str, enum.Enum):
    INTACT = "intact"
    NEUTERED = "neutered"
    SPAYED = "spayed"
    UNKNOWN = "unknown"


class AgeGroup(str, enum.Enum):
    BABY = "baby"
    YOUNG = "young"
    ADULT = "adult"
    SENIOR = "senior"
    UNKNOWN = "unknown"


class SizeEstimated(str, enum.Enum):
    UNKNOWN = "unknown"


class Animal(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "animals"
    __table_args__ = (
        Index(
            "ix_animals_org_deleted_created",
            "organization_id",
            "deleted_at",
            "created_at",
        ),
    )

    organization_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    public_code: Mapped[str | None] = mapped_column(
        String(50), unique=True, nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    species: Mapped[Species] = mapped_column(
        Enum(
            Species,
            name="species_enum",
            create_constraint=False,
            native_enum=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )
    sex: Mapped[Sex] = mapped_column(
        Enum(
            Sex,
            name="sex_enum",
            create_constraint=False,
            native_enum=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        default=Sex.UNKNOWN,
    )
    status: Mapped[AnimalStatus] = mapped_column(
        Enum(
            AnimalStatus,
            name="animal_status_enum",
            create_constraint=False,
            native_enum=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        default=AnimalStatus.INTAKE,
    )
    altered_status: Mapped[AlteredStatus] = mapped_column(
        Enum(
            AlteredStatus,
            name="altered_status_enum",
            create_constraint=False,
            native_enum=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        default=AlteredStatus.UNKNOWN,
    )
    birth_date_estimated: Mapped[date | None] = mapped_column(Date, nullable=True)
    age_group: Mapped[AgeGroup] = mapped_column(
        Enum(
            AgeGroup,
            name="age_group_enum",
            create_constraint=False,
            native_enum=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        default=AgeGroup.UNKNOWN,
    )
    color: Mapped[str | None] = mapped_column(Text, nullable=True)
    coat: Mapped[str | None] = mapped_column(Text, nullable=True)
    size_estimated: Mapped[SizeEstimated] = mapped_column(
        Enum(
            SizeEstimated,
            name="size_estimated_enum",
            create_constraint=False,
            native_enum=False,
            values_callable=lambda x: [e.value for e in x],
        ),
        default=SizeEstimated.UNKNOWN,
    )
    weight_current_kg: Mapped[float | None] = mapped_column(
        Numeric(6, 2), nullable=True
    )
    mer_kcal_per_day: Mapped[int | None] = mapped_column(Integer, nullable=True)
    weight_estimated_kg: Mapped[float | None] = mapped_column(
        Numeric(6, 2), nullable=True
    )
    status_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    outcome_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    public_visibility: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    primary_photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_dewormed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_aggressive: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_pregnant: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_lactating: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_critical: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_diabetic: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_cancer: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    bcs: Mapped[int | None] = mapped_column(Integer, nullable=True)
    expected_litter_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    behavior_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_special_needs: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    # Relationships
    animal_breeds = relationship(
        "AnimalBreed",
        back_populates="animal",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    identifiers = relationship(
        "AnimalIdentifier",
        back_populates="animal",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    tags = relationship(
        "Tag",
        secondary="animal_tags",
        back_populates="animals",
        lazy="selectin",
    )
    weight_logs = relationship(
        "AnimalWeightLog",
        back_populates="animal",
        lazy="noload",
        cascade="all, delete-orphan",
        order_by="AnimalWeightLog.measured_at.desc()",
    )
    bcs_logs = relationship(
        "AnimalBCSLog",
        back_populates="animal",
        lazy="noload",
        cascade="all, delete-orphan",
        order_by="AnimalBCSLog.measured_at.desc()",
    )
    passport = relationship(
        "AnimalPassport",
        back_populates="animal",
        uselist=False,
        lazy="noload",
    )
