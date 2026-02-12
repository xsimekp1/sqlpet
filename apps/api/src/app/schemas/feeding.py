"""Pydantic schemas for feeding endpoints."""

from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional, Dict, Any
import uuid


# Food schemas
class FoodBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    brand: Optional[str] = Field(None, max_length=255)
    type: str  # dry, wet, raw, medical, other
    kcal_per_100g: Optional[float] = None


class FoodCreate(FoodBase):
    pass


class FoodResponse(FoodBase):
    id: uuid.UUID
    organization_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Feeding Plan schemas
class FeedingPlanBase(BaseModel):
    animal_id: uuid.UUID
    food_id: Optional[uuid.UUID] = None
    amount_g: Optional[float] = None
    amount_text: Optional[str] = None
    times_per_day: Optional[int] = None
    schedule_json: Optional[Dict[str, Any]] = None
    start_date: date
    end_date: Optional[date] = None
    notes: Optional[str] = None


class FeedingPlanCreate(FeedingPlanBase):
    pass


class FeedingPlanUpdate(BaseModel):
    food_id: Optional[uuid.UUID] = None
    amount_g: Optional[float] = None
    amount_text: Optional[str] = None
    times_per_day: Optional[int] = None
    schedule_json: Optional[Dict[str, Any]] = None
    end_date: Optional[date] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class FeedingPlanResponse(FeedingPlanBase):
    id: uuid.UUID
    organization_id: uuid.UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Feeding Log schemas
class FeedingLogCreate(BaseModel):
    animal_id: uuid.UUID
    amount_text: Optional[str] = None
    notes: Optional[str] = None
    auto_deduct_inventory: bool = True


class FeedingLogResponse(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    animal_id: uuid.UUID
    fed_at: datetime
    fed_by_user_id: Optional[uuid.UUID]
    amount_text: Optional[str]
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# Task completion schema for feeding tasks
class CompleteFeedingTaskRequest(BaseModel):
    notes: Optional[str] = None


class CompleteFeedingTaskResponse(BaseModel):
    task: Dict[str, Any]
    feeding_log: FeedingLogResponse
