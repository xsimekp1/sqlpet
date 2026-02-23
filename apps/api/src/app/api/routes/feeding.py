"""API routes for feeding management."""

import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from datetime import datetime, timedelta, timezone

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
    FeedingPlanListResponse,
    FeedingLogCreate,
    FeedingLogResponse,
    CompleteFeedingTaskRequest,
    CompleteFeedingTaskResponse,
    LotDeductionResponse,
    MERCalculateRequest,
    MERCalculationResponse,
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
@router.post(
    "/plans", response_model=FeedingPlanResponse, status_code=status.HTTP_201_CREATED
)
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
        mer_calculation=plan_data.mer_calculation,
    )
    await db.commit()
    return plan


@router.get("/plans/{plan_id}", response_model=FeedingPlanResponse)
async def get_feeding_plan(
    plan_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Get a single feeding plan by ID."""
    from sqlalchemy import select
    from src.app.models.feeding_plan import FeedingPlan

    result = await db.execute(
        select(FeedingPlan).where(
            FeedingPlan.id == plan_id,
            FeedingPlan.organization_id == organization_id,
        )
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Feeding plan not found")
    return plan


@router.get("/plans", response_model=FeedingPlanListResponse)
async def list_feeding_plans(
    animal_id: Optional[uuid.UUID] = Query(None, description="Filter by animal"),
    food_id: Optional[uuid.UUID] = Query(None, description="Filter by food item"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """List feeding plans."""
    from sqlalchemy import select, and_, func
    from src.app.models.feeding_plan import FeedingPlan

    conditions = [FeedingPlan.organization_id == organization_id]
    if animal_id:
        conditions.append(FeedingPlan.animal_id == animal_id)
    if food_id:
        conditions.append(FeedingPlan.food_id == food_id)
    if is_active is not None:
        conditions.append(FeedingPlan.is_active == is_active)

    count_stmt = select(func.count()).select_from(FeedingPlan).where(and_(*conditions))
    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()

    stmt = (
        select(FeedingPlan)
        .where(and_(*conditions))
        .order_by(FeedingPlan.start_date.desc())
    )
    result = await db.execute(stmt)
    items = result.scalars().all()

    return {"items": items, "total": total}


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
@router.post(
    "/logs", response_model=FeedingLogResponse, status_code=status.HTTP_201_CREATED
)
async def log_feeding(
    log_data: FeedingLogCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Log that an animal was fed (manual, outside task system)."""
    feeding_service = FeedingService(db)

    result = await feeding_service.log_feeding(
        organization_id=organization_id,
        animal_id=log_data.animal_id,
        fed_by_user_id=current_user.id,
        amount_text=log_data.amount_text,
        notes=log_data.notes,
        auto_deduct_inventory=log_data.auto_deduct_inventory,
    )
    await db.commit()
    return result["feeding_log"]


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
            deductions=[
                LotDeductionResponse(
                    lot_id=d["lot_id"],
                    lot_number=d["lot_number"],
                    quantity_deducted=d["quantity_deducted"],
                    cost_per_unit=d["cost_per_unit"],
                    lot_emptied=d["lot_emptied"],
                )
                for d in result.get("deductions", [])
            ],
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


# MER / RER calculation endpoint
@router.post("/calculate-mer", response_model=MERCalculationResponse)
async def calculate_mer(
    request: MERCalculateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """
    Calculate RER/MER (energy requirements) for an animal.
    Returns a full transparent breakdown of each factor.
    """
    from sqlalchemy import select
    from src.app.models.animal import Animal
    from src.app.models.food import Food
    from src.app.services.mer_calculator import calculate_mer as _calc_mer

    # Load animal
    result = await db.execute(
        select(Animal).where(
            Animal.id == request.animal_id,
            Animal.organization_id == organization_id,
            Animal.deleted_at.is_(None),
        )
    )
    animal = result.scalar_one_or_none()
    if animal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found"
        )

    if animal.weight_current_kg is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Animal has no current weight recorded. Please log a weight first.",
        )

    # Optionally load food kcal_per_100g
    food_kcal: Optional[float] = request.food_kcal_per_100g
    if request.food_id and food_kcal is None:
        food_result = await db.execute(
            select(Food).where(
                Food.id == request.food_id, Food.organization_id == organization_id
            )
        )
        food = food_result.scalar_one_or_none()
        if food and food.kcal_per_100g:
            food_kcal = float(food.kcal_per_100g)

    snapshot = _calc_mer(
        weight_kg=float(animal.weight_current_kg),
        species=animal.species.value
        if hasattr(animal.species, "value")
        else str(animal.species),
        altered_status=animal.altered_status.value
        if hasattr(animal.altered_status, "value")
        else str(animal.altered_status),
        age_group=animal.age_group.value
        if hasattr(animal.age_group, "value")
        else str(animal.age_group),
        bcs=animal.bcs,
        health_modifier=request.health_modifier,
        environment=request.environment,
        breed_size=animal.size_estimated.value
        if hasattr(animal.size_estimated, "value")
        else "unknown",
        weight_goal=request.weight_goal,
        food_kcal_per_100g=food_kcal,
        meals_per_day=request.meals_per_day,
    )

    # Attach food_id to recommendation if provided
    if snapshot.get("food_recommendation") and request.food_id:
        snapshot["food_recommendation"]["food_id"] = str(request.food_id)

    return snapshot


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


# Epic 8 - Rolling window task generation
@router.post("/tasks/ensure-window", status_code=status.HTTP_201_CREATED)
async def ensure_feeding_tasks_window(
    hours_ahead: int = Query(
        48, ge=1, le=168, description="Hours ahead to generate tasks for"
    ),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Ensure feeding tasks exist for next N hours. Idempotent."""
    from src.app.core.config import settings

    feeding_service = FeedingService(db)

    from_dt = datetime.now(timezone.utc)
    to_dt = from_dt + timedelta(hours=hours_ahead)

    tasks = await feeding_service.ensure_feeding_tasks_window(
        organization_id, from_dt, to_dt
    )
    await db.commit()

    return {
        "tasks_created": len(tasks),
        "window_from": from_dt.isoformat(),
        "window_to": to_dt.isoformat(),
    }


# Auto-generate tasks + get today's feeding tasks
@router.get("/today")
async def get_todays_feeding_tasks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """
    Get today's feeding tasks. Automatically generates tasks if they don't exist.
    Combines task generation (for next 48h) with returning today's tasks.
    """
    feeding_service = FeedingService(db)

    # Auto-generate tasks for next 48 hours (idempotent - won't create duplicates)
    await feeding_service.ensure_feeding_tasks_window(
        organization_id,
        datetime.now(timezone.utc),
        datetime.now(timezone.utc) + timedelta(hours=48),
    )
    await db.commit()

    # Return today's feeding tasks
    from sqlalchemy import select, and_
    from src.app.models.task import Task, TaskStatus, TaskType

    today = datetime.now().date()
    stmt = select(Task).where(
        and_(
            Task.organization_id == organization_id,
            Task.type == TaskType.FEEDING,
            Task.status != TaskStatus.CANCELLED,
        )
    )
    result = await db.execute(stmt)
    all_tasks = result.scalars().all()

    # Filter to today's tasks
    todays_tasks = [t for t in all_tasks if t.due_at and t.due_at.date() == today]

    # Sort by due time
    todays_tasks.sort(key=lambda t: t.due_at or datetime.max)

    return {
        "tasks": [
            {
                "id": str(t.id),
                "title": t.title,
                "description": t.description,
                "status": t.status.value,
                "due_at": t.due_at.isoformat() if t.due_at else None,
                "task_metadata": t.task_metadata,
                "related_entity_id": str(t.related_entity_id)
                if t.related_entity_id
                else None,
            }
            for t in todays_tasks
        ],
        "generated": True,
    }
