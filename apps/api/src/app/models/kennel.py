import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.app.db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin


class KennelSizeCategory(str, enum.Enum):
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"
    XLARGE = "xlarge"


class KennelType(str, enum.Enum):
    INDOOR = "indoor"
    OUTDOOR = "outdoor"
    ISOLATION = "isolation"
    QUARANTINE = "quarantine"


class KennelStatus(str, enum.Enum):
    AVAILABLE = "available"
    MAINTENANCE = "maintenance"
    CLOSED = "closed"


class Zone(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "zones"
    __table_args__ = (
        Index(
            "ix_zones_org_deleted_created",
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
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    color: Mapped[str | None] = mapped_column(
        String(7), nullable=True
    )  # hex color like #FF5733
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    kennels = relationship(
        "Kennel",
        back_populates="zone",
        lazy="selectin",
        cascade="all, delete-orphan",
    )


class Kennel(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "kennels"
    __table_args__ = (
        Index(
            "ix_kennels_org_deleted_created",
            "organization_id",
            "deleted_at",
            "created_at",
        ),
        Index("ix_kennels_zone_code", "zone_id", "code"),
    )

    organization_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    zone_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("zones.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    code: Mapped[str] = mapped_column(String(32), nullable=False, index=True)

    # Capacity and sizing
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    capacity_rules: Mapped[dict | None] = mapped_column(
        JSON, nullable=True
    )  # Flexible capacity by species
    size_category: Mapped[KennelSizeCategory] = mapped_column(
        Enum(
            KennelSizeCategory,
            name="kennel_size_category_enum",
            create_constraint=False,
            native_enum=True,
        ),
        default=KennelSizeCategory.MEDIUM,
        nullable=False,
    )

    # Status and type
    status: Mapped[KennelStatus] = mapped_column(
        Enum(
            KennelStatus,
            name="kennel_status_enum",
            create_constraint=False,
            native_enum=True,
        ),
        default=KennelStatus.AVAILABLE,
        nullable=False,
    )
    type: Mapped[KennelType] = mapped_column(
        Enum(
            KennelType,
            name="kennel_type_enum",
            create_constraint=False,
            native_enum=True,
        ),
        default=KennelType.INDOOR,
        nullable=False,
    )

    # Physical properties
    dimensions: Mapped[dict | None] = mapped_column(
        JSON, nullable=True
    )  # {"length": 200, "width": 150, "height": 180}
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    primary_photo_path: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Map layout properties
    map_x: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    map_y: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    map_w: Mapped[int] = mapped_column(Integer, nullable=False, default=160)
    map_h: Mapped[int] = mapped_column(Integer, nullable=False, default=120)
    map_rotation: Mapped[int | None] = mapped_column(Integer, nullable=True)
    map_meta: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Relationships
    zone = relationship("Zone", back_populates="kennels")
    stays = relationship(
        "KennelStay",
        back_populates="kennel",
        lazy="selectin",
        cascade="all, delete-orphan",
    )
    photos = relationship(
        "KennelPhoto",
        back_populates="kennel",
        lazy="selectin",
        cascade="all, delete-orphan",
    )


class KennelStay(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "kennel_stays"
    __table_args__ = (
        Index("ix_kennel_stays_org_active", "organization_id", "end_at"),
        Index("ix_kennel_stays_kennel_active", "kennel_id", "end_at"),
        Index("ix_kennel_stays_animal_active", "animal_id", "end_at"),
    )

    organization_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kennel_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("kennels.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    animal_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("animals.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    start_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    end_at: Mapped[datetime | None] = mapped_column(nullable=True)

    reason: Mapped[str | None] = mapped_column(String(64), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    moved_by: Mapped[str | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    kennel = relationship("Kennel", back_populates="stays")
    animal = relationship("Animal")


class KennelPhoto(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "kennel_photos"
    __table_args__ = (
        Index("ix_kennel_photos_org_kennel", "organization_id", "kennel_id"),
        Index("ix_kennel_photos_primary", "kennel_id", "is_primary"),
    )

    organization_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kennel_id: Mapped[str] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("kennels.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_by: Mapped[str | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Relationships
    kennel = relationship("Kennel", back_populates="photos")
