import enum
from sqlalchemy import (
    Column,
    String,
    Text,
    BigInteger,
    Boolean,
    ForeignKey,
    DateTime,
    Enum,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from ..db.base import Base, UUIDPrimaryKeyMixin, TimestampMixin


class StorageProvider(str, enum.Enum):
    LOCAL = "local"
    SUPABASE = "supabase"


class File(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "files"

    organization_id: str = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    storage_provider: str = Column(
        Enum(StorageProvider, values_callable=lambda x: [e.value for e in x]),
        default=StorageProvider.SUPABASE.value,
        nullable=False,
    )
    storage_path: str = Column(Text, nullable=False)  # Supabase path or local path
    original_filename: str = Column(Text, nullable=False)
    mime_type: str = Column(String(100), nullable=False)
    size_bytes: int = Column(BigInteger, nullable=False)

    # Optional metadata
    description: str = Column(Text, nullable=True)
    is_public: bool = Column(Boolean, default=False, nullable=False)
    uploaded_by_user_id: str = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    # Relationships
    organization = relationship("Organization", back_populates="files")
    uploaded_by_user = relationship("User")

    # Many-to-many relationships for linking to entities
    entity_files = relationship(
        "EntityFile", back_populates="file", cascade="all, delete-orphan"
    )


class EntityFile(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "entity_files"

    organization_id: str = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    entity_type: str = Column(
        String(50), nullable=False
    )  # 'animal', 'kennel', 'document', etc.
    entity_id: str = Column(UUID(as_uuid=True), nullable=False)
    file_id: str = Column(
        UUID(as_uuid=True), ForeignKey("files.id", ondelete="CASCADE"), nullable=False
    )

    # Additional metadata for entity-specific file purposes
    purpose: str = Column(
        String(50), nullable=True
    )  # 'primary_photo', 'document', 'medical_record', etc.
    sort_order: int = Column(BigInteger, default=0, nullable=False)

    # Relationships
    file = relationship("File", back_populates="entity_files")


class DefaultAnimalImage(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "default_animal_images"

    species: str = Column(
        String(20), nullable=False, index=True
    )  # 'dog', 'cat', 'rabbit', 'bird'
    breed_id: str = Column(
        UUID(as_uuid=True),
        ForeignKey("breeds.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    color_pattern: str = Column(
        String(100), nullable=True, index=True
    )  # 'black', 'brown', 'white', 'spotted'

    # Storage info
    storage_path: str = Column(Text, nullable=False)  # Path in Supabase
    public_url: str = Column(Text, nullable=False)  # Public URL for display

    # Metadata
    filename_pattern: str = Column(
        String(255), nullable=True
    )  # Original filename for reference
    is_active: bool = Column(Boolean, default=True, nullable=False)
    priority: int = Column(
        BigInteger, default=0, nullable=False
    )  # Higher number = higher priority
    source: str = Column(
        String(50), default="uploaded", nullable=False
    )  # 'uploaded', 'generated', 'stock'

    # Relationships
    breed = relationship("Breed")

    __table_args__ = (
        {"schema": None},  # Use default schema
    )


class AnimalPhoto(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "animal_photos"

    organization_id: str = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    animal_id: str = Column(
        UUID(as_uuid=True),
        ForeignKey("animals.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Storage info
    file_id: str = Column(
        UUID(as_uuid=True), ForeignKey("files.id", ondelete="CASCADE"), nullable=False
    )

    # Photo metadata
    is_primary: bool = Column(Boolean, default=False, nullable=False)
    caption: str = Column(Text, nullable=True)
    sort_order: int = Column(BigInteger, default=0, nullable=False)
    uploaded_by_user_id: str = Column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )

    # Relationships
    organization = relationship("Organization")
    animal = relationship("Animal")
    file = relationship("File")
    uploaded_by_user = relationship("User")
