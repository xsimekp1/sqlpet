from typing import Any, List
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from src.app.api.dependencies.auth import get_current_user, get_current_organization_id
from src.app.api.dependencies.db import get_db
from src.app.models.kennel import Kennel, KennelStay
from src.app.models.user import User
from src.app.services.kennel_service import (
    move_animal,
    CapacityError,
    InvalidStateError,
    NotFoundError,
)

router = APIRouter(prefix="/kennels", tags=["kennels"])


@router.get("")
async def list_kennels(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    zone_id: str | None = Query(None),
    status: str | None = Query(None),
    search: str | None = Query(None, alias="q"),
):
    """List kennels with basic info for initial testing."""

    # Simple query for now
    query = select(Kennel).where(Kennel.organization_id == organization_id)

    if zone_id:
        query = query.where(Kennel.zone_id == zone_id)

    if status:
        query = query.where(Kennel.status == status)

    if search:
        query = query.where(
            (Kennel.name.ilike(f"%{search}%")) | (Kennel.code.ilike(f"%{search}%"))
        )

    query = query.order_by(Kennel.code.asc())
    result = await session.execute(query)
    kennels = result.scalars().all()

    # Simple response for testing
    return [
        {
            "id": str(k.id),
            "code": k.code,
            "name": k.name,
            "zone_id": str(k.zone_id),
            "status": k.status,
            "type": k.type,
            "size_category": k.size_category,
            "capacity": k.capacity,
            "occupied_count": 0,  # TODO: Add occupancy calculation
            "animals_preview": [],  # TODO: Add animal previews
        }
        for k in kennels
    ]


@router.post("/move")
async def move_animal_endpoint(
    animal_id: str,
    target_kennel_id: str | None,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Simple move endpoint for testing."""

    try:
        result = await move_animal(
            session,
            organization_id=organization_id,
            actor_user_id=current_user.id,
            animal_id=uuid.UUID(animal_id),
            target_kennel_id=uuid.UUID(target_kennel_id) if target_kennel_id else None,
            reason="move",
            notes=None,
            allow_overflow=False,
        )
        await session.commit()
        return result
    except (CapacityError, InvalidStateError, NotFoundError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{kennel_id}")
async def get_kennel(
    kennel_id: str,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Get kennel details."""

    kennel_q = select(Kennel).where(
        Kennel.id == kennel_id, Kennel.organization_id == organization_id
    )
    kennel = (await session.execute(kennel_q)).scalar_one_or_none()
    if not kennel:
        raise HTTPException(status_code=404, detail="Kennel not found")

    return {
        "id": str(kennel.id),
        "code": kennel.code,
        "name": kennel.name,
        "zone_id": str(kennel.zone_id),
        "status": kennel.status,
        "type": kennel.type,
        "size_category": kennel.size_category,
        "capacity": kennel.capacity,
        "occupied_count": 0,
        "animals": [],
        "notes": kennel.notes,
    }
