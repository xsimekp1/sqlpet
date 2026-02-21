import uuid
from datetime import date, datetime
from decimal import Decimal
from functools import cached_property

from pydantic import BaseModel, ConfigDict, Field, computed_field

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
    id: uuid.UUID | None = None
    name: str = Field(..., min_length=1, max_length=255)
    public_code: str | None = None
    species: Species
    sex: Sex = "unknown"
    status: AnimalStatus = "intake"
    altered_status: AlteredStatus = "unknown"
    birth_date_estimated: date | None = None
    age_group: AgeGroup = "unknown"
    color: str | None = None
    coat: str | None = None
    collar_color: str | None = None  # Litter identification collar color
    size_estimated: SizeEstimated = "unknown"
    weight_current_kg: Decimal | None = None
    mer_kcal_per_day: int | None = None
    weight_estimated_kg: Decimal | None = None
    status_reason: str | None = None
    outcome_date: date | None = None
    description: str | None = None
    public_visibility: bool = False
    featured: bool = False
    is_dewormed: bool = False
    is_aggressive: bool = False
    is_pregnant: bool = False
    is_lactating: bool = False
    is_critical: bool = False
    is_diabetic: bool = False
    is_cancer: bool = False
    bcs: int | None = None
    expected_litter_date: date | None = None
    behavior_notes: str | None = None
    is_special_needs: bool = False
    primary_photo_url: str | None = None
    thumbnail_url: str | None = None
    default_image_url: str | None = None
    current_kennel_id: str | None = None
    current_kennel_name: str | None = None
    current_kennel_code: str | None = None
    last_walked_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    breeds: list[AnimalBreedEntry] = []
    identifiers: list[AnimalIdentifierCreate] = []
    tags: list[TagResponse] = []

    @computed_field
    @cached_property
    def estimated_age_years(self) -> float | None:
        if not self.birth_date_estimated:
            return None
        today = date.today()
        bd = self.birth_date_estimated
        years = today.year - bd.year
        if (today.month, today.day) < (bd.month, bd.day):
            years -= 1
        return years

    model_config = {"from_attributes": True, "use_enum_values": True}


class AnimalResponse(AnimalCreate):
    organization_id: uuid.UUID
    current_intake_date: date | None = None
    current_intake_reason: str | None = None
    breeds: list[AnimalBreedResponse] = []
    identifiers: list[AnimalIdentifierResponse] = []

    # Legal deadline (computed for found animals)
    legal_deadline_at: date | None = None
    legal_deadline_type: str | None = None
    legal_deadline_days_left: int | None = None
    legal_deadline_state: str | None = None
    legal_deadline_label: str | None = None

    # Intake legal fields
    notice_published_at: date | None = None
    finder_claims_ownership: bool | None = None
    municipality_irrevocably_transferred: bool | None = None


class AnimalUpdate(BaseModel):
    id: uuid.UUID | None = None
    name: str | None = Field(None, min_length=1, max_length=255)
    species: Species | None = None
    sex: Sex | None = None
    status: AnimalStatus | None = None
    altered_status: AlteredStatus | None = None
    birth_date_estimated: date | None = None
    age_group: AgeGroup | None = None
    color: str | None = None
    coat: str | None = None
    collar_color: str | None = None  # Litter identification collar color
    size_estimated: SizeEstimated | None = None
    weight_current_kg: Decimal | None = None
    mer_kcal_per_day: int | None = None
    weight_estimated_kg: Decimal | None = None
    status_reason: str | None = None
    outcome_date: date | None = None
    description: str | None = None
    public_visibility: bool | None = None
    featured: bool | None = None
    is_dewormed: bool | None = None
    is_aggressive: bool | None = None
    is_pregnant: bool | None = None
    is_lactating: bool | None = None
    is_critical: bool | None = None
    is_diabetic: bool | None = None
    is_cancer: bool | None = None
    bcs: int | None = None
    expected_litter_date: date | None = None
    behavior_notes: str | None = None
    is_special_needs: bool | None = None
    primary_photo_url: str | None = None
    thumbnail_url: str | None = None
    default_image_url: str | None = None
    current_kennel_id: str | None = None
    current_kennel_name: str | None = None
    current_kennel_code: str | None = None
    last_walked_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class AnimalListResponse(BaseModel):
    items: list[AnimalCreate]
    total: int
    page: int
    page_size: int
    has_more: bool = False
