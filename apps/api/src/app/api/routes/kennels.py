from typing import Any, List
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from src.app.api.dependencies.auth import get_current_user, get_current_organization_id
from src.app.api.dependencies.db import get_db
from src.app.models.kennel import Kennel, KennelStay, Zone
from src.app.models.user import User
from src.app.models.animal import Animal
from pydantic import BaseModel, Field
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
    type: str | None = Query(None),
    size_category: str | None = Query(None),
    search: str | None = Query(None, alias="q"),
):
    """List kennels with occupancy and animal previews."""

    # Subquery for occupancy count
    occ_sq = (
        select(
            KennelStay.kennel_id.label("kennel_id"),
            func.count().label("occupied_count"),
        )
        .where(
            KennelStay.organization_id == organization_id, KennelStay.end_at.is_(None)
        )
        .group_by(KennelStay.kennel_id)
        .subquery()
    )

    # Main query
    query = (
        select(Kennel, Zone, func.coalesce(occ_sq.c.occupied_count, 0))
        .join(Zone, Kennel.zone_id == Zone.id)
        .outerjoin(occ_sq, occ_sq.c.kennel_id == Kennel.id)
        .where(Kennel.organization_id == organization_id)
    )

    if zone_id:
        query = query.where(Kennel.zone_id == zone_id)

    if status:
        query = query.where(Kennel.status == status)

    if type:
        query = query.where(Kennel.type == type)

    if size_category:
        query = query.where(Kennel.size_category == size_category)

    if search:
        query = query.where(
            (Kennel.name.ilike(f"%{search}%"))
            | (Kennel.code.ilike(f"%{search}%"))
            | (Zone.name.ilike(f"%{search}%"))
        )

    query = query.order_by(Kennel.code.asc())
    result = await session.execute(query)
    kennels_data = result.all()

    # Extract kennel IDs for animal query
    kennel_ids = [str(k.id) for k, _, _ in kennels_data]

    # Get animal previews (limit to 16 per kennel for performance)
    if kennel_ids:
        animal_query = (
            select(
                Animal.id,
                Animal.name,
                Animal.current_kennel_id,
                Animal.primary_photo_url,
                Animal.species,
            )
            .where(
                Animal.organization_id == organization_id,
                Animal.current_kennel_id.in_(kennel_ids),
            )
            .order_by(Animal.name.asc())
        )
        animal_result = await session.execute(animal_query)
        animals = animal_result.all()
    else:
        animals = []

    # Group animals by kennel
    animals_by_kennel: dict[str, List[dict]] = {}
    for animal_id, name, kennel_id, photo_url, species in animals:
        kennel_key = str(kennel_id)
        if kennel_key not in animals_by_kennel:
            animals_by_kennel[kennel_key] = []
        animals_by_kennel[kennel_key].append(
            {
                "id": str(animal_id),
                "name": name,
                "photo_url": photo_url,
                "species": species,
            }
        )

    # Build response
    return [
        {
            "id": str(k.id),
            "code": k.code,
            "name": k.name,
            "zone_id": str(k.zone_id),
            "zone_name": zone.name,
            "status": k.status,
            "type": k.type,
            "size_category": k.size_category,
            "capacity": k.capacity,
            "capacity_rules": k.capacity_rules,
            "primary_photo_path": k.primary_photo_path,
            "occupied_count": int(occupied_count),
            "animals_preview": animals_by_kennel.get(str(k.id), [])[:16],
            "alerts": _calculate_alerts(k, int(occupied_count)),
            "map_x": k.map_x,
            "map_y": k.map_y,
            "map_w": k.map_w,
            "map_h": k.map_h,
            "map_rotation": k.map_rotation,
            "map_meta": k.map_meta,
        }
        for k, zone, occupied_count in kennels_data
    ]


class UpdateKennelLayoutRequest(BaseModel):
    """Request model for updating kennel layout"""

    map_x: int
    map_y: int
    map_w: int
    map_h: int
    map_rotation: int | None = None


class CreateKennelRequest(BaseModel):
    """Request model for creating a kennel"""

    code: str = Field(..., description="Kennel code (unique)")
    name: str = Field(..., description="Kennel display name")
    zone_id: str = Field(..., description="Zone ID")
    type: str = Field(..., description="Kennel type")
    size_category: str = Field(..., description="Size category")
    capacity: int = Field(..., ge=1, description="Maximum capacity")
    notes: str | None = Field(None, description="Optional notes")


class UpdateKennelRequest(BaseModel):
    """Request model for updating a kennel"""

    name: str | None = Field(None, description="Kennel display name")
    zone_id: str | None = Field(None, description="Zone ID")
    type: str | None = Field(None, description="Kennel type")
    size_category: str | None = Field(None, description="Size category")
    capacity: int | None = Field(None, ge=1, description="Maximum capacity")
    status: str | None = Field(None, description="Operational status")
    notes: str | None = Field(None, description="Optional notes")


@router.patch("/{kennel_id}/layout")
async def update_kennel_layout(
    kennel_id: str,
    request: UpdateKennelLayoutRequest,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Update kennel layout (position and size)."""

    # TODO: Add kennels.manage permission check

    # Get kennel
    kennel_q = select(Kennel).where(
        Kennel.id == kennel_id, Kennel.organization_id == organization_id
    )
    kennel = (await session.execute(kennel_q)).scalar_one_or_none()
    if not kennel:
        raise HTTPException(status_code=404, detail="Kennel not found")

    # Update layout properties
    kennel.map_x = request.map_x
    kennel.map_y = request.map_y
    kennel.map_w = request.map_w
    kennel.map_h = request.map_h
    kennel.map_rotation = request.map_rotation

    await session.commit()

    return {
        "id": str(kennel.id),
        "map_x": kennel.map_x,
        "map_y": kennel.map_y,
        "map_w": kennel.map_w,
        "map_h": kennel.map_h,
        "map_rotation": kennel.map_rotation,
    }


def _calculate_alerts(kennel: Kennel, occupied_count: int) -> List[str]:
    """Calculate alerts for a kennel"""
    alerts = []

    # Overcapacity alert
    if occupied_count > kennel.capacity:
        alerts.append("overcapacity")

    # Maintenance status alert
    if kennel.status == "maintenance" and occupied_count > 0:
        alerts.append("animals_in_maintenance")

    # Quarantine mixed species alert (simplified)
    if kennel.type == "quarantine" and occupied_count > 1:
        alerts.append("quarantine_mix")

    return alerts


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
        "map_x": kennel.map_x,
        "map_y": kennel.map_y,
        "map_w": kennel.map_w,
        "map_h": kennel.map_h,
        "map_rotation": kennel.map_rotation,
        "map_meta": kennel.map_meta,
    }
