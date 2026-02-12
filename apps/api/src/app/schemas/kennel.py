from typing import Any, Optional, Dict, Union
from enum import Enum
from pydantic import BaseModel, Field, validator
from uuid import UUID


class KennelType(str, Enum):
    INDOOR = "indoor"
    OUTDOOR = "outdoor"
    ISOLATION = "isolation"
    QUARANTINE = "quarantine"


class KennelSizeCategory(str, Enum):
    SMALL = "small"
    MEDIUM = "medium"
    LARGE = "large"
    XLARGE = "xlarge"


class KennelStatus(str, Enum):
    AVAILABLE = "available"
    MAINTENANCE = "maintenance"
    CLOSED = "closed"


class KennelBase(BaseModel):
    name: str = Field(..., min_length=3, max_length=200, description="Název kotce")
    zone_id: str = Field(..., description="ID zóny, do které kotce patří")
    type: KennelType = Field(..., description="Typ kotce")
    size_category: KennelSizeCategory = Field(..., description="Velikostní kategorie")
    capacity: int = Field(..., ge=1, le=50, description="Maximální kapacita kotce")
    capacity_rules: Optional[Dict[str, int]] = Field(None, description="Kapacitní pravidla pro jednotlivé druhy zvířat")
    primary_photo_path: Optional[str] = Field(None, description="Cesta k primární fotce kotce")
    notes: Optional[str] = Field(None, max_length=1000, description="Poznámky ke kotci")

    @validator('capacity_rules')
    def validate_capacity_rules(cls, v):
        if v is not None:
            for species, capacity in v.items():
                if not isinstance(capacity, int) or capacity < 1 or capacity > 50:
                    raise ValueError(f"Invalid capacity for {species}: {capacity}. Must be 1-50")
        return v


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
    target_kennel_id: Union[str, None]  # None = remove from kennel
    reason: str = "move"
    notes: str | None = None
    allow_overflow: bool = False


class MoveAnimalResponse(BaseModel):
    status: str
    animal_id: str
    to: str | None = None
    occupied: int | None = None
    capacity: int | None = None


class ZoneCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    code: str = Field(..., min_length=1, max_length=32)
    color: Optional[str] = Field(None, regex=r"^#[0-9A-Fa-f]{6}$")  # hex color
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