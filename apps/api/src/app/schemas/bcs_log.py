import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class BCSLogCreate(BaseModel):
    bcs: int = Field(..., ge=1, le=9)
    notes: str | None = None
    measured_at: datetime | None = None  # defaults to now() if not provided


class BCSLogResponse(BaseModel):
    id: uuid.UUID
    animal_id: uuid.UUID
    bcs: int
    measured_at: datetime
    notes: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
