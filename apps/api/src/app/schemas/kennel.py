from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class KennelBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    code: str = Field(..., min_length=1, max_length=32)
    zone_id: str
    capacity: int = Field(..., ge=1, le=50)
    capacity_rules: dict[str, Any] | None = None
    size_category: str = Field(default="medium")
    status: str = Field(default="available")
    type: str = Field(default="indoor")
    dimensions: dict[str, Any] | None = None
    notes: str | None = None


class KennelCreate(KennelBase):
    pass


class KennelUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    code: str | None = Field(None, min_length=1, max_length=32)
    zone_id: str | None = None
    capacity: int | None = Field(None, ge=1, le=50)
    capacity_rules: dict[str, Any] | None = None
    size_category: str | None = None
    status: str | None = None
    type: str | None = None
    dimensions: dict[str, Any] | None = None
    notes: str | None = None
    primary_photo_path: str | None = None


class AnimalPreview(BaseModel):
    id: str
    name: str
    photo: str | None = None


class KennelResponse(BaseModel):
    id: str
    code: str
    name: str
    zone_id: str
    status: str
    type: str
    size_category: str
    capacity: int
    capacity_rules: dict[str, Any] | None
    occupied_count: int
    animals: list[dict[str, Any]]
    primary_photo_path: str | None
    notes: str | None
    dimensions: dict[str, Any] | None


class KennelListResponse(BaseModel):
    kennels: list[dict[str, Any]]


class MoveAnimalRequest(BaseModel):
    animal_id: str
    target_kennel_id: str | None  # None = remove from kennel
    reason: str = "move"
    notes: str | None = None
    allow_overflow: bool = False


class MoveAnimalResponse(BaseModel):
    status: str
    animal_id: str
    from: str | None = None
    to: str | None = None
    occupied: int | None = None
    capacity: int | None = None


class ZoneCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    code: str = Field(..., min_length=1, max_length=32)
    color: str | None = Field(None, regex=r"^#[0-9A-Fa-f]{6}$")  # hex color
    description: str | None = None


class ZoneUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    code: str | None = Field(None, min_length=1, max_length=32)
    color: str | None = None
    description: str | None = None


class ZoneResponse(BaseModel):
    id: str
    name: str
    code: str
    color: str | None
    description: str | None
    created_at: str
    updated_at: str