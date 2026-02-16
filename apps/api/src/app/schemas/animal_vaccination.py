import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class VaccinationCreate(BaseModel):
    animal_id: uuid.UUID
    vaccination_type: str = Field(..., min_length=1, max_length=50)
    lot_id: Optional[uuid.UUID] = None
    administered_at: datetime
    administered_by_id: Optional[uuid.UUID] = None
    task_id: Optional[uuid.UUID] = None
    notes: Optional[str] = None


class VaccinationUpdate(BaseModel):
    vaccination_type: Optional[str] = None
    lot_id: Optional[uuid.UUID] = None
    administered_at: Optional[datetime] = None
    notes: Optional[str] = None


class VaccinationResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    animal_id: uuid.UUID
    vaccination_type: str
    lot_id: Optional[uuid.UUID] = None
    lot_number: Optional[str] = None
    administered_at: datetime
    administered_by_id: Optional[uuid.UUID] = None
    task_id: Optional[uuid.UUID] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VaccinationWithAnimalResponse(VaccinationResponse):
    animal_name: Optional[str] = None
    animal_public_code: Optional[str] = None


class VaccinationListResponse(BaseModel):
    items: list[VaccinationWithAnimalResponse]
    total: int
    page: int
    page_size: int
