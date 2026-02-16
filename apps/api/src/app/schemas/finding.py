import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class FindingCreate(BaseModel):
    who_found_id: Optional[uuid.UUID] = None
    where_lat: Optional[float] = None
    where_lng: Optional[float] = None
    when_found: datetime
    notes: Optional[str] = None
    animal_id: Optional[uuid.UUID] = None


class FindingUpdate(BaseModel):
    who_found_id: Optional[uuid.UUID] = None
    where_lat: Optional[float] = None
    where_lng: Optional[float] = None
    when_found: Optional[datetime] = None
    notes: Optional[str] = None
    animal_id: Optional[uuid.UUID] = None


class FindingResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    who_found_id: Optional[uuid.UUID] = None
    where_lat: Optional[float] = None
    where_lng: Optional[float] = None
    when_found: datetime
    notes: Optional[str] = None
    animal_id: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FindingWithAnimalResponse(FindingResponse):
    animal_name: Optional[str] = None
    animal_public_code: Optional[str] = None
    who_found_name: Optional[str] = None


class FindingListResponse(BaseModel):
    items: list[FindingWithAnimalResponse]
    total: int
    page: int
    page_size: int
