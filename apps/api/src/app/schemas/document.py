"""Document template and instance schemas."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from src.app.models.document_template import DocumentStatus


# --- DocumentTemplate schemas ---


class DocumentTemplateCreate(BaseModel):
    """Schema for creating a new document template."""
    code: str = Field(..., min_length=1, max_length=64)
    name: str = Field(..., min_length=1, max_length=255)
    language: str = Field(default="cs", min_length=2, max_length=5)
    content_html: str = Field(..., min_length=1)
    description: str | None = None
    is_active: bool = True


class DocumentTemplateUpdate(BaseModel):
    """Schema for updating a document template."""
    code: str | None = Field(None, min_length=1, max_length=64)
    name: str | None = Field(None, min_length=1, max_length=255)
    language: str | None = Field(None, min_length=2, max_length=5)
    content_html: str | None = Field(None, min_length=1)
    description: str | None = None
    is_active: bool | None = None


class DocumentTemplateResponse(BaseModel):
    """Schema for document template response."""
    id: UUID
    organization_id: UUID | None
    code: str
    name: str
    language: str
    content_html: str
    description: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    created_by_user_id: UUID | None

    model_config = {"from_attributes": True}


class DocumentTemplateListResponse(BaseModel):
    """Schema for list of document templates."""
    items: list[DocumentTemplateResponse]
    total: int


# --- DocumentInstance schemas ---


class DocumentInstanceCreate(BaseModel):
    """Schema for creating a new document instance."""
    template_id: UUID | None = None  # Optional - can use template_code instead
    template_code: str | None = None  # Alternative to template_id
    donor_contact_id: UUID | None = None
    manual_fields: dict = Field(default_factory=dict)
    status: DocumentStatus = DocumentStatus.FINAL

    model_config = {"use_enum_values": True}


class DocumentInstanceResponse(BaseModel):
    """Schema for document instance response."""
    id: UUID
    organization_id: UUID
    animal_id: UUID
    template_id: UUID
    created_by_user_id: UUID
    manual_fields: dict
    rendered_html: str | None
    pdf_storage_path: str | None
    pdf_url: str | None
    status: DocumentStatus
    created_at: datetime
    # Include template info for convenience
    template_name: str | None = None
    template_code: str | None = None
    # Include creator info
    created_by_name: str | None = None

    model_config = {"from_attributes": True, "use_enum_values": True}


class DocumentInstanceListResponse(BaseModel):
    """Schema for list of document instances."""
    items: list[DocumentInstanceResponse]
    total: int


class DocumentPreviewResponse(BaseModel):
    """Schema for document preview."""
    document_id: UUID
    rendered_html: str
    preview_url: str | None = None
    pdf_url: str | None = None
