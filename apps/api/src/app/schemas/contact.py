import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


ContactType = Literal[
    "donor", "veterinarian", "volunteer", "foster", "supplier", "partner", "other"
]


class ContactCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    type: ContactType
    email: str | None = None
    phone: str | None = None
    profession: str | None = None
    organization_name: str | None = None
    address: str | None = None
    bank_account: str | None = None
    tax_id: str | None = None
    notes: str | None = None


class ContactUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    type: ContactType | None = None
    email: str | None = None
    phone: str | None = None
    profession: str | None = None
    organization_name: str | None = None
    address: str | None = None
    bank_account: str | None = None
    tax_id: str | None = None
    notes: str | None = None
    is_active: bool | None = None


class ContactResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    name: str
    type: str
    email: str | None = None
    phone: str | None = None
    profession: str | None = None
    organization_name: str | None = None
    address: str | None = None
    bank_account: str | None = None
    tax_id: str | None = None
    notes: str | None = None
    avatar_url: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ContactListResponse(BaseModel):
    items: list[ContactResponse]
    total: int
    page: int
    page_size: int
