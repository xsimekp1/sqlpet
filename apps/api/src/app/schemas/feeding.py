"""Pydantic schemas for feeding endpoints."""

from pydantic import BaseModel, Field, field_validator
from datetime import datetime, date
from typing import Optional, Dict, Any, List
import uuid


# MER / RER calculation schemas


class MERFactor(BaseModel):
    value: float
    label: str


class MERFoodRecommendation(BaseModel):
    food_id: Optional[uuid.UUID] = None
    kcal_per_100g: float
    amount_g_per_day: float
    meals_per_day: int
    amount_g_per_meal: float


class MERCalculationResponse(BaseModel):
    weight_kg: float
    rer: float
    factors: Dict[str, Any]
    mer_total_factor: float
    mer_kcal: float
    food_recommendation: Optional[MERFoodRecommendation] = None
    calculated_at: str


class MERCalculateRequest(BaseModel):
    animal_id: uuid.UUID
    health_modifier: str = "healthy"
    environment: str = "indoor"
    weight_goal: str = "maintain"
    food_id: Optional[uuid.UUID] = None
    food_kcal_per_100g: Optional[float] = None  # manual override if no food_id
    meals_per_day: int = Field(2, ge=1, le=10)


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
    mer_calculation: Optional[Dict[str, Any]] = None  # MER snapshot at plan creation

    @field_validator('schedule_json')
    @classmethod
    def validate_schedule_json(cls, v, info):
        """Validate schedule_json structure and amounts array."""
        if v is None:
            return v

        # Check if times array exists
        times = v.get('times', [])
        if not times:
            return v

        # Check if amounts array exists
        amounts = v.get('amounts', [])
        if not amounts:
            return v

        # Validate amounts length matches times length
        if len(amounts) != len(times):
            raise ValueError(f'amounts array length ({len(amounts)}) must match times array length ({len(times)})')

        # Get amount_g from validation info (if available)
        amount_g = info.data.get('amount_g')
        if amount_g is not None:
            # Validate sum of amounts approximately equals amount_g (allow 1g rounding tolerance)
            total_amount = sum(amounts)
            if abs(total_amount - amount_g) > 1:
                raise ValueError(f'Sum of amounts ({total_amount}g) must equal daily amount ({amount_g}g) ±1g')

        return v


class FeedingPlanUpdate(BaseModel):
    food_id: Optional[uuid.UUID] = None
    amount_g: Optional[float] = None
    amount_text: Optional[str] = None
    times_per_day: Optional[int] = None
    schedule_json: Optional[Dict[str, Any]] = None
    end_date: Optional[date] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator('schedule_json')
    @classmethod
    def validate_schedule_json(cls, v, info):
        """Validate schedule_json structure and amounts array."""
        if v is None:
            return v

        # Check if times array exists
        times = v.get('times', [])
        if not times:
            return v

        # Check if amounts array exists
        amounts = v.get('amounts', [])
        if not amounts:
            return v

        # Validate amounts length matches times length
        if len(amounts) != len(times):
            raise ValueError(f'amounts array length ({len(amounts)}) must match times array length ({len(times)})')

        # Get amount_g from validation info (if available)
        amount_g = info.data.get('amount_g')
        if amount_g is not None:
            # Validate sum of amounts approximately equals amount_g (allow 1g rounding tolerance)
            total_amount = sum(amounts)
            if abs(total_amount - amount_g) > 1:
                raise ValueError(f'Sum of amounts ({total_amount}g) must equal daily amount ({amount_g}g) ±1g')

        return v


class FeedingPlanResponse(FeedingPlanBase):
    id: uuid.UUID
    organization_id: uuid.UUID
    is_active: bool
    mer_calculation: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FeedingPlanListResponse(BaseModel):
    items: list[FeedingPlanResponse]
    total: int


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


class LotDeductionResponse(BaseModel):
    lot_id: uuid.UUID
    lot_number: Optional[str] = None
    quantity_deducted: float
    cost_per_unit: Optional[float] = None
    lot_emptied: bool


class CompleteFeedingTaskResponse(BaseModel):
    task: Dict[str, Any]
    feeding_log: FeedingLogResponse
    deductions: List[LotDeductionResponse] = []
