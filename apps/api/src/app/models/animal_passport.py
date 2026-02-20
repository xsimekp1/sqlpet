"""Animal Passport models."""
from sqlalchemy import Column, String, Date, Text, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from src.app.db.base import Base


class AnimalPassport(Base):
    """Animal vaccination passport model."""

    __tablename__ = "animal_passports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    animal_id = Column(UUID(as_uuid=True), ForeignKey("animals.id", ondelete="CASCADE"), nullable=False, unique=True)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    passport_number = Column(String(64), nullable=True)
    issued_at = Column(Date, nullable=True)
    issuer_name = Column(String(128), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    animal = relationship("Animal", back_populates="passport")
    documents = relationship("AnimalPassportDocument", back_populates="passport", cascade="all, delete-orphan")


class AnimalPassportDocument(Base):
    """Animal passport document model (scans/photos)."""

    __tablename__ = "animal_passport_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    passport_id = Column(UUID(as_uuid=True), ForeignKey("animal_passports.id", ondelete="CASCADE"), nullable=False)
    file_id = Column(UUID(as_uuid=True), ForeignKey("files.id", ondelete="CASCADE"), nullable=False)
    document_type = Column(String(20), default="scan")
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    passport = relationship("AnimalPassport", back_populates="documents")
    file = relationship("File")
