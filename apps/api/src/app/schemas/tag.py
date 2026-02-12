import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TagBase(BaseModel):
    """Base schema for Tag"""
    name: str = Field(..., min_length=1, max_length=100)
    color: str | None = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")


class TagCreate(TagBase):
    """Schema for creating a new tag"""
    pass


class TagUpdate(BaseModel):
    """Schema for updating a tag"""
    name: str | None = Field(None, min_length=1, max_length=100)
    color: str | None = Field(None, pattern=r"^#[0-9A-Fa-f]{6}$")


class TagResponse(TagBase):
    """Schema for tag response"""
    id: uuid.UUID
    organization_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
