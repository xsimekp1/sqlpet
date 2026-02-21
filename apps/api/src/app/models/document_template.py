"""Document Template models for generating contracts and forms."""
from sqlalchemy import Column, String, Text, Boolean, ForeignKey, DateTime, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, Mapped, mapped_column
from datetime import datetime
import enum
import uuid

from src.app.db.base import Base


class DocumentStatus(str, enum.Enum):
    """Status of generated document instance."""
    DRAFT = "draft"
    FINAL = "final"


class DocumentTemplate(Base):
    """
    Template for generating documents (contracts, forms, etc.).

    Templates contain HTML/Markdown with placeholders like {{animal.name}}, {{org.name}}.
    Admins can create and edit templates.
    """
    __tablename__ = "document_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=True,  # NULL = global template, otherwise org-specific override
        index=True
    )

    # Template identification
    code = Column(String(64), nullable=False, index=True)  # e.g. "donation_contract_dog"
    name = Column(String(255), nullable=False)  # e.g. "Darovací smlouva na psa"
    language = Column(String(5), nullable=False, default="cs")  # cs, en

    # Template content
    content_html = Column(Text, nullable=False)  # HTML with {{placeholders}}
    description = Column(Text, nullable=True)  # Optional description for admins

    # Status
    is_active = Column(Boolean, nullable=False, default=True)

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    created_by_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Relationships
    instances = relationship("DocumentInstance", back_populates="template", cascade="all, delete-orphan")
    organization = relationship("Organization")
    created_by = relationship("User")

    def __repr__(self):
        return f"<DocumentTemplate {self.code} ({self.language})>"


class DocumentInstance(Base):
    """
    Generated document instance (final or draft).

    Stores a snapshot of the rendered document with all data filled in.
    """
    __tablename__ = "document_instances"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    # References
    animal_id = Column(
        UUID(as_uuid=True),
        ForeignKey("animals.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    template_id = Column(
        UUID(as_uuid=True),
        ForeignKey("document_templates.id", ondelete="RESTRICT"),
        nullable=False
    )
    created_by_user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )

    # Manual fields (user-entered data not in DB)
    # Example: {"place": "Praha", "date": "2024-01-15", "health_state": "Zdravý", ...}
    manual_fields = Column(JSONB, nullable=False, default=dict)

    # Rendered output (cached)
    rendered_html = Column(Text, nullable=True)  # Final HTML after placeholder replacement

    # Optional PDF storage
    pdf_storage_path = Column(String(512), nullable=True)
    pdf_url = Column(String(512), nullable=True)

    # Status
    status = Column(
        SQLEnum(DocumentStatus, name="document_status_enum"),
        nullable=False,
        default=DocumentStatus.FINAL
    )

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    animal = relationship("Animal")
    template = relationship("DocumentTemplate", back_populates="instances")
    organization = relationship("Organization")
    created_by = relationship("User")

    def __repr__(self):
        return f"<DocumentInstance {self.id} for Animal {self.animal_id}>"
