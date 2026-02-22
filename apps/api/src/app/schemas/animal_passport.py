"""Animal Passport schemas."""
from pydantic import BaseModel, Field, ConfigDict
from datetime import date, datetime
from typing import Optional
import uuid


class PassportBase(BaseModel):
    """Base passport schema."""

    passport_number: Optional[str] = None
    issued_at: Optional[date] = None
    issuer_name: Optional[str] = None
    notes: Optional[str] = None


class PassportCreate(PassportBase):
    """Create passport schema."""

    pass


class PassportUpdate(PassportBase):
    """Update passport schema."""

    pass


class PassportDocumentResponse(BaseModel):
    """Passport document response schema."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    file_id: uuid.UUID
    document_type: str
    created_at: datetime
    file_url: Optional[str] = None
    file_name: Optional[str] = None


class PassportResponse(PassportBase):
    """Passport response schema."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    animal_id: uuid.UUID
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    documents: list[PassportDocumentResponse] = Field(default_factory=list)


class VaccinationExpiring(BaseModel):
    """Vaccination expiring schema."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    animal_id: uuid.UUID
    animal_name: str
    animal_public_code: Optional[str] = None
    vaccine_type: str
    administered_at: date
    valid_until: Optional[date] = None
    days_until_expiration: Optional[int] = None
    status: str  # "expired", "expiring_soon", "expiring_later"


class VaccinationExpirationSummary(BaseModel):
    """Vaccination expiration summary schema."""

    total_vaccinations: int
    expiring_within_14_days: int
    expiring_within_30_days: int
    expired: int
    upcoming: list[VaccinationExpiring] = Field(default_factory=list)
