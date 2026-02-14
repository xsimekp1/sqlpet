import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from src.app.models.animal import (
    AgeGroup,
    AlteredStatus,
    AnimalStatus,
    Sex,
    SizeEstimated,
    Species,
)
from src.app.models.animal_identifier import IdentifierType
from src.app.schemas.tag import TagResponse


# --- Breed schemas ---


class BreedResponse(BaseModel):
    id: uuid.UUID
    species: Species
    name: str
    display_name: str | None = None  # Translated name from breeds_i18n

    model_config = {"from_attributes": True}


class BreedColorImageResponse(BaseModel):
    color: str
    image_url: str


# --- AnimalBreed schemas ---


class AnimalBreedEntry(BaseModel):
    breed_id: uuid.UUID
    percent: int | None = None


class AnimalBreedResponse(BaseModel):
    breed_id: uuid.UUID
    breed_name: str
    breed_species: Species
    percent: int | None = None


# --- AnimalIdentifier schemas ---


class AnimalIdentifierCreate(BaseModel):
    type: IdentifierType
    value: str = Field(..., min_length=1, max_length=255)
    registry: str | None = None
    issued_at: date | None = None


class AnimalIdentifierResponse(BaseModel):
    id: uuid.UUID
    type: IdentifierType
    value: str
    registry: str | None = None
    issued_at: date | None = None

    model_config = {"from_attributes": True}


# --- Animal CRUD schemas ---


class AnimalCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    species: Species
    sex: Sex = "unknown"
    status: AnimalStatus = "intake"
    altered_status: AlteredStatus = "unknown"
    birth_date_estimated: date | None = None
    age_group: AgeGroup = "unknown"
    color: str | None = None
    coat: str | None = None
    size_estimated: SizeEstimated = "unknown"
    weight_current_kg: Decimal | None = None
    weight_estimated_kg: Decimal | None = None
    status_reason: str | None = None
    intake_date: date | None = None
    outcome_date: date | None = None
    description: str | None = None
    public_visibility: bool = False
    featured: bool = False
    is_dewormed: bool = False
    is_aggressive: bool = False
    is_pregnant: bool = False
    bcs: int | None = Field(None, ge=1, le=9)
    expected_litter_date: date | None = None
    behavior_notes: str | None = None
    is_special_needs: bool = False
    breeds: list[AnimalBreedEntry] | None = None
    identifiers: list[AnimalIdentifierCreate] | None = None


class AnimalUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    species: Species | None = None
    sex: Sex | None = None
    status: AnimalStatus | None = None
    altered_status: AlteredStatus | None = None
    birth_date_estimated: date | None = None
    age_group: AgeGroup | None = None
    color: str | None = None
    coat: str | None = None
    size_estimated: SizeEstimated | None = None
    weight_current_kg: Decimal | None = None
    weight_estimated_kg: Decimal | None = None
    status_reason: str | None = None
    intake_date: date | None = None
    outcome_date: date | None = None
    description: str | None = None
    public_visibility: bool | None = None
    featured: bool | None = None
    is_dewormed: bool | None = None
    is_aggressive: bool | None = None
    is_pregnant: bool | None = None
    bcs: int | None = Field(None, ge=1, le=9)
    expected_litter_date: date | None = None
    behavior_notes: str | None = None
    is_special_needs: bool | None = None
    breeds: list[AnimalBreedEntry] | None = None
    identifiers: list[AnimalIdentifierCreate] | None = None


class AnimalResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    public_code: str | None = None
    name: str
    species: Species
    sex: Sex
    status: AnimalStatus
    altered_status: AlteredStatus
    birth_date_estimated: date | None = None
    age_group: AgeGroup
    color: str | None = None
    coat: str | None = None
    size_estimated: SizeEstimated
    weight_current_kg: Decimal | None = None
    weight_estimated_kg: Decimal | None = None
    status_reason: str | None = None
    intake_date: date | None = None
    outcome_date: date | None = None
    description: str | None = None
    public_visibility: bool
    featured: bool
    is_dewormed: bool
    is_aggressive: bool
    is_pregnant: bool
    bcs: int | None = None
    expected_litter_date: date | None = None
    behavior_notes: str | None = None
    is_special_needs: bool = False
    primary_photo_url: str | None = None
    default_image_url: str | None = None
    current_kennel_id: str | None = None
    current_kennel_name: str | None = None
    current_kennel_code: str | None = None
    created_at: datetime
    updated_at: datetime
    breeds: list[AnimalBreedResponse] = []
    identifiers: list[AnimalIdentifierResponse] = []
    tags: list[TagResponse] = []

    model_config = {"from_attributes": True}


class AnimalListResponse(BaseModel):
    items: list[AnimalResponse]
    total: int
    page: int
    page_size: int
