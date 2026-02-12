"""API routes for feeding management."""

import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from datetime import datetime

from src.app.api.dependencies.auth import get_current_user, get_current_organization_id
from src.app.api.dependencies.db import get_db
from src.app.models.user import User
from src.app.models.food import FoodType
from src.app.schemas.feeding import (
    FoodCreate,
    FoodResponse,
    FeedingPlanCreate,
    FeedingPlanUpdate,
    FeedingPlanResponse,
    FeedingLogCreate,
    FeedingLogResponse,
    CompleteFeedingTaskRequest,
    CompleteFeedingTaskResponse,
)
from src.app.services.feeding_service import FeedingService

router = APIRouter(prefix="/feeding", tags=["feeding"])


# Food endpoints
@router.post("/foods", response_model=FoodResponse, status_code=status.HTTP_201_CREATED)
async def create_food(
    food_data: FoodCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Create a new food item."""
    feeding_service = FeedingService(db)

    try:
        food_type = FoodType(food_data.type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid food type: {food_data.type}",
        )

    from src.app.models.food import Food
    food = Food(
        id=uuid.uuid4(),
        organization_id=organization_id,
        name=food_data.name,
        brand=food_data.brand,
        type=food_type,
        kcal_per_100g=food_data.kcal_per_100g,
    )
    db.add(food)
    await db.commit()
    await db.refresh(food)
    return food


# Feeding Plan endpoints
@router.post("/plans", response_model=FeedingPlanResponse, status_code=status.HTTP_201_CREATED)
async def create_feeding_plan(
    plan_data: FeedingPlanCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Create a new feeding plan for an animal."""
    feeding_service = FeedingService(db)

    plan = await feeding_service.create_feeding_plan(
        organization_id=organization_id,
        animal_id=plan_data.animal_id,
        start_date=plan_data.start_date,
        created_by_id=current_user.id,
        food_id=plan_data.food_id,
        amount_g=plan_data.amount_g,
        amount_text=plan_data.amount_text,
        times_per_day=plan_data.times_per_day,
        schedule_json=plan_data.schedule_json,
        end_date=plan_data.end_date,
        notes=plan_data.notes,
    )
    await db.commit()
    return plan


@router.get("/plans", response_model=List[FeedingPlanResponse])
async def list_feeding_plans(
    animal_id: Optional[uuid.UUID] = Query(None, description="Filter by animal"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """List feeding plans."""
    from sqlalchemy import select, and_
    from src.app.models.feeding_plan import FeedingPlan

    conditions = [FeedingPlan.organization_id == organization_id]
    if animal_id:
        conditions.append(FeedingPlan.animal_id == animal_id)
    if is_active is not None:
        conditions.append(FeedingPlan.is_active == is_active)

    stmt = select(FeedingPlan).where(and_(*conditions))
    result = await db.execute(stmt)
    return result.scalars().all()


@router.put("/plans/{plan_id}", response_model=FeedingPlanResponse)
async def update_feeding_plan(
    plan_id: uuid.UUID,
    plan_data: FeedingPlanUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Update a feeding plan."""
    feeding_service = FeedingService(db)

    try:
        updates = {k: v for k, v in plan_data.dict().items() if v is not None}
        plan = await feeding_service.update_feeding_plan(
            plan_id=plan_id,
            organization_id=organization_id,
            user_id=current_user.id,
            **updates,
        )
        await db.commit()
        return plan
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.delete("/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_feeding_plan(
    plan_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Deactivate a feeding plan."""
    feeding_service = FeedingService(db)

    try:
        await feeding_service.deactivate_feeding_plan(
            plan_id=plan_id,
            organization_id=organization_id,
            user_id=current_user.id,
        )
        await db.commit()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


# Feeding Log endpoints
@router.post("/logs", response_model=FeedingLogResponse, status_code=status.HTTP_201_CREATED)
async def log_feeding(
    log_data: FeedingLogCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Log that an animal was fed (manual, outside task system)."""
    feeding_service = FeedingService(db)

    feeding_log = await feeding_service.log_feeding(
        organization_id=organization_id,
        animal_id=log_data.animal_id,
        fed_by_user_id=current_user.id,
        amount_text=log_data.amount_text,
        notes=log_data.notes,
        auto_deduct_inventory=log_data.auto_deduct_inventory,
    )
    await db.commit()
    return feeding_log


@router.get("/logs", response_model=List[FeedingLogResponse])
async def list_feeding_logs(
    animal_id: Optional[uuid.UUID] = Query(None, description="Filter by animal"),
    days: int = Query(30, ge=1, le=365, description="Days of history"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """List feeding logs."""
    feeding_service = FeedingService(db)

    if animal_id:
        logs = await feeding_service.get_feeding_history(
            animal_id=animal_id,
            organization_id=organization_id,
            days=days,
        )
    else:
        from sqlalchemy import select, and_
        from src.app.models.feeding_log import FeedingLog
        from datetime import timedelta, timezone

        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        stmt = (
            select(FeedingLog)
            .where(
                and_(
                    FeedingLog.organization_id == organization_id,
                    FeedingLog.fed_at >= cutoff,
                )
            )
            .order_by(FeedingLog.fed_at.desc())
        )
        result = await db.execute(stmt)
        logs = result.scalars().all()

    return logs


# Task integration
@router.post("/tasks/{task_id}/complete", response_model=CompleteFeedingTaskResponse)
async def complete_feeding_task(
    task_id: uuid.UUID,
    request: CompleteFeedingTaskRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Complete a feeding task - creates feeding log and deducts inventory."""
    feeding_service = FeedingService(db)

    try:
        result = await feeding_service.complete_feeding_task(
            task_id=task_id,
            organization_id=organization_id,
            completed_by_user_id=current_user.id,
            notes=request.notes,
        )
        await db.commit()

        # Convert task to dict for response
        from src.app.schemas.task import TaskResponse
        task_response = TaskResponse.from_orm(result["task"])

        return CompleteFeedingTaskResponse(
            task=task_response.dict(),
            feeding_log=result["feeding_log"],
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# Manual task generation (MVP - no Celery Beat)
@router.post("/generate-tasks", status_code=status.HTTP_201_CREATED)
async def generate_feeding_tasks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Generate feeding tasks for all active feeding plans (manual trigger for MVP)."""
    feeding_service = FeedingService(db)

    tasks = await feeding_service.generate_feeding_tasks_for_schedule(
        organization_id=organization_id,
        current_time=datetime.now(),
    )
    await db.commit()

    return {
        "tasks_created": len(tasks),
        "message": f"Generated {len(tasks)} feeding tasks",
    }
