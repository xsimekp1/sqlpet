import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class WeightLogCreate(BaseModel):
    weight_kg: Decimal = Field(..., ge=Decimal("0.1"), le=Decimal("999.99"))
    notes: str | None = None
    measured_at: datetime | None = None  # defaults to now() if not provided


class WeightLogResponse(BaseModel):
    id: uuid.UUID
    animal_id: uuid.UUID
    weight_kg: Decimal
    measured_at: datetime
    notes: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
