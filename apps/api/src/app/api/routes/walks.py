import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.dependencies.auth import (
    get_current_organization_id,
    require_permission,
    get_current_user,
)
from src.app.api.dependencies.db import get_db
from src.app.models.animal import Animal
from src.app.models.user import User
from src.app.models.walk_log import WalkLog
from src.app.schemas.walk_log import (
    WalkCreate,
    WalkListResponse,
    WalkResponse,
    WalkUpdate,
    WalkWithAnimalsResponse,
)

router = APIRouter(prefix="/walks", tags=["walks"])


def _to_response(walk: WalkLog) -> WalkResponse:
    return WalkResponse.model_validate(walk)


async def _to_response_with_animals(
    walk: WalkLog, db: AsyncSession
) -> WalkWithAnimalsResponse:
    data = WalkWithAnimalsResponse.model_validate(walk)

    animal_ids = walk.animal_ids or []
    if animal_ids:
        result = await db.execute(select(Animal).where(Animal.id.in_(animal_ids)))
        animals = result.scalars().all()
        data.animals = [
            {"id": a.id, "name": a.name, "public_code": a.public_code} for a in animals
        ]

    return data


@router.post("", response_model=WalkResponse, status_code=status.HTTP_201_CREATED)
async def create_walk(
    data: WalkCreate,
    current_user: User = Depends(require_permission("tasks.write")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    walk = WalkLog(
        id=uuid.uuid4(),
        organization_id=organization_id,
        animal_ids=[str(aid) for aid in data.animal_ids],
        walk_type=data.walk_type,
        started_at=data.started_at or datetime.utcnow(),
        started_by_id=current_user.id,
        status="in_progress",
    )
    db.add(walk)
    await db.commit()
    await db.refresh(walk)
    return _to_response(walk)


@router.get("", response_model=WalkListResponse)
async def list_walks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    animal_id: Optional[uuid.UUID] = Query(None),
    status: Optional[str] = Query(None),
    walk_type: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    current_user: User = Depends(require_permission("tasks.read")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    q = select(WalkLog).where(WalkLog.organization_id == organization_id)

    if animal_id:
        q = q.where(WalkLog.animal_ids.contains(str(animal_id)))
    if status:
        q = q.where(WalkLog.status == status)
    if walk_type:
        q = q.where(WalkLog.walk_type == walk_type)
    if date_from:
        try:
            date_from_dt = datetime.fromisoformat(date_from)
            q = q.where(WalkLog.started_at >= date_from_dt)
        except ValueError:
            pass
    if date_to:
        try:
            date_to_dt = datetime.fromisoformat(date_to + "T23:59:59")
            q = q.where(WalkLog.started_at <= date_to_dt)
        except ValueError:
            pass

    count_q = select(func.count()).select_from(q.subquery())
    total_result = await db.execute(count_q)
    total = total_result.scalar()

    q = (
        q.order_by(WalkLog.started_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(q)
    walks = result.scalars().all()

    items = []
    for w in walks:
        item = await _to_response_with_animals(w, db)
        items.append(item)

    return WalkListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/animal/{animal_id}", response_model=WalkListResponse)
async def get_animal_walks(
    animal_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_permission("tasks.read")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    animal_result = await db.execute(
        select(Animal).where(
            Animal.id == animal_id,
            Animal.organization_id == organization_id,
        )
    )
    animal = animal_result.scalar_one_or_none()
    if not animal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found"
        )

    q = select(WalkLog).where(
        WalkLog.animal_ids.contains(str(animal_id)),
        WalkLog.organization_id == organization_id,
    )

    count_q = select(func.count()).select_from(q.subquery())
    total_result = await db.execute(count_q)
    total = total_result.scalar()

    q = (
        q.order_by(WalkLog.started_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(q)
    walks = result.scalars().all()

    items = []
    for w in walks:
        item = await _to_response_with_animals(w, db)
        items.append(item)

    return WalkListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{walk_id}", response_model=WalkWithAnimalsResponse)
async def get_walk(
    walk_id: uuid.UUID,
    current_user: User = Depends(require_permission("tasks.read")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WalkLog).where(
            WalkLog.id == walk_id,
            WalkLog.organization_id == organization_id,
        )
    )
    walk = result.scalar_one_or_none()
    if not walk:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Walk not found"
        )
    return await _to_response_with_animals(walk, db)


@router.get("/today", response_model=WalkListResponse)
async def get_today_walks(
    current_user: User = Depends(require_permission("tasks.read")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    today = datetime.utcnow().date()
    start_of_day = datetime.combine(today, datetime.min.time())
    end_of_day = datetime.combine(today, datetime.max.time())

    q = select(WalkLog).where(
        WalkLog.organization_id == organization_id,
        WalkLog.started_at >= start_of_day,
        WalkLog.started_at <= end_of_day,
    )

    result = await db.execute(q.order_by(WalkLog.started_at.desc()))
    walks = result.scalars().all()

    items = []
    for w in walks:
        item = await _to_response_with_animals(w, db)
        items.append(item)

    return WalkListResponse(
        items=items,
        total=len(items),
        page=1,
        page_size=100,
    )


@router.patch("/{walk_id}", response_model=WalkResponse)
async def update_walk(
    walk_id: uuid.UUID,
    data: WalkUpdate,
    current_user: User = Depends(require_permission("tasks.write")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WalkLog).where(
            WalkLog.id == walk_id,
            WalkLog.organization_id == organization_id,
        )
    )
    walk = result.scalar_one_or_none()
    if not walk:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Walk not found"
        )

    update_data = data.model_dump(exclude_unset=True)

    if data.ended_at and not walk.ended_at:
        walk.ended_by_id = current_user.id
        if walk.started_at and data.ended_at:
            duration = (data.ended_at - walk.started_at).total_seconds() / 60
            walk.duration_minutes = int(duration)

    for field, value in update_data.items():
        setattr(walk, field, value)

    await db.commit()
    await db.refresh(walk)
    return _to_response(walk)


@router.post("/{walk_id}/complete", response_model=WalkResponse)
async def complete_walk(
    walk_id: uuid.UUID,
    distance_km: Optional[float] = Query(None),
    notes: Optional[str] = Query(None),
    current_user: User = Depends(require_permission("tasks.write")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WalkLog).where(
            WalkLog.id == walk_id,
            WalkLog.organization_id == organization_id,
        )
    )
    walk = result.scalar_one_or_none()
    if not walk:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Walk not found"
        )

    if walk.status == "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Walk already completed"
        )

    walk.status = "completed"
    walk.ended_at = datetime.utcnow()
    walk.ended_by_id = current_user.id

    if walk.started_at:
        duration = (walk.ended_at - walk.started_at).total_seconds() / 60
        walk.duration_minutes = int(duration)

    if distance_km is not None:
        walk.distance_km = distance_km
    if notes is not None:
        walk.notes = notes

    await db.commit()
    await db.refresh(walk)
    return _to_response(walk)


@router.delete("/{walk_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_walk(
    walk_id: uuid.UUID,
    current_user: User = Depends(require_permission("tasks.write")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WalkLog).where(
            WalkLog.id == walk_id,
            WalkLog.organization_id == organization_id,
        )
    )
    walk = result.scalar_one_or_none()
    if not walk:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Walk not found"
        )

    await db.delete(walk)
    await db.commit()
