import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class WalkCreate(BaseModel):
    animal_ids: list[uuid.UUID] = Field(..., min_length=1)
    walk_type: str = Field(default="walk", pattern="^(walk|visit|exercise)$")
    started_at: datetime = Field(default_factory=datetime.utcnow)
    distance_km: Optional[float] = None
    notes: Optional[str] = None


class WalkUpdate(BaseModel):
    walk_type: Optional[str] = None
    ended_at: Optional[datetime] = None
    distance_km: Optional[float] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class WalkResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    animal_ids: list
    walk_type: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    started_by_id: Optional[uuid.UUID] = None
    ended_by_id: Optional[uuid.UUID] = None
    distance_km: Optional[float] = None
    notes: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WalkWithAnimalsResponse(WalkResponse):
    animals: list[dict] = []


class WalkListResponse(BaseModel):
    items: list[WalkWithAnimalsResponse]
    total: int
    page: int
    page_size: int
