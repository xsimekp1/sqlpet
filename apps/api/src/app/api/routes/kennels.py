from typing import Any, List
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text

from src.app.api.dependencies.auth import get_current_user, get_current_organization_id
from src.app.api.dependencies.db import get_db
from src.app.models.kennel import Kennel, KennelStay, Zone
from src.app.models.user import User
from src.app.models.animal import Animal
from pydantic import BaseModel, Field
from src.app.services.kennel_service import (
    create_kennel,
    move_animal,
    CapacityError,
    InvalidStateError,
    NotFoundError,
)
from src.app.schemas.kennel import KennelCreate

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

    try:
        where_clauses = ["k.organization_id = :org_id", "k.deleted_at IS NULL"]
        params: dict = {"org_id": str(organization_id)}

        if zone_id:
            where_clauses.append("k.zone_id = :zone_id")
            params["zone_id"] = zone_id
        if status:
            where_clauses.append("k.status::text = :status")
            params["status"] = status
        if type:
            where_clauses.append("k.type::text = :type")
            params["type"] = type
        if size_category:
            where_clauses.append("k.size_category::text = :size_category")
            params["size_category"] = size_category
        if search:
            where_clauses.append("(k.name ILIKE :search OR k.code ILIKE :search)")
            params["search"] = f"%{search}%"

        where_sql = " AND ".join(where_clauses)

        kennels_query = text(f"""
            SELECT
                k.id, k.code, k.name, k.zone_id, z.name AS zone_name,
                k.status::text AS status, k.type::text AS type,
                k.size_category::text AS size_category, k.capacity,
                k.map_x, k.map_y, k.map_w, k.map_h,
                COUNT(ks.id) FILTER (WHERE ks.end_at IS NULL) AS occupied_count,
                COALESCE(
                  json_agg(
                    json_build_object(
                      'id', a.id::text,
                      'name', a.name,
                      'species', a.species::text,
                      'photo_url', a.primary_photo_url
                    ) ORDER BY ks.start_at
                  ) FILTER (WHERE ks.end_at IS NULL AND a.id IS NOT NULL),
                  '[]'::json
                ) AS animals_preview
            FROM kennels k
            LEFT JOIN zones z ON z.id = k.zone_id
            LEFT JOIN kennel_stays ks ON ks.kennel_id = k.id
            LEFT JOIN animals a ON a.id = ks.animal_id AND a.deleted_at IS NULL
            WHERE {where_sql}
            GROUP BY k.id, k.code, k.name, k.zone_id, z.name,
                     k.status, k.type, k.size_category, k.capacity,
                     k.map_x, k.map_y, k.map_w, k.map_h
            ORDER BY k.name
        """)

        kennels_result = await session.execute(kennels_query, params)
        kennels_rows = kennels_result.fetchall()

        kennels = []
        for row in kennels_rows:
            occupied = int(row.occupied_count or 0)
            animals_preview = row.animals_preview if row.animals_preview else []
            # Limit preview to 5
            animals_preview = animals_preview[:5]
            kennel_dict = {
                "id": str(row.id),
                "code": row.code,
                "name": row.name,
                "zone_id": str(row.zone_id),
                "zone_name": row.zone_name or "",
                "status": row.status or "available",
                "type": row.type or "indoor",
                "size_category": row.size_category or "medium",
                "capacity": row.capacity or 1,
                "occupied_count": occupied,
                "animals_preview": animals_preview,
                "alerts": _calculate_alerts_from_data(
                    row.status or "available", row.type or "indoor", occupied, row.capacity or 1
                ),
                "map_x": row.map_x or 0,
                "map_y": row.map_y or 0,
                "map_w": row.map_w or 160,
                "map_h": row.map_h or 120,
            }
            kennels.append(kennel_dict)

        return kennels

    except Exception as e:
        import traceback

        print(f"ERROR in kennels endpoint: {e}")
        print(f"ERROR traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


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


def _calculate_alerts_from_data(status: str, type: str, occupied_count: int, capacity: int) -> List[str]:
    """Calculate alerts from raw string data (used in raw SQL responses)"""
    alerts = []
    if occupied_count > capacity:
        alerts.append("overcapacity")
    if status == "maintenance" and occupied_count > 0:
        alerts.append("animals_in_maintenance")
    if type == "quarantine" and occupied_count > 1:
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

    try:
        kennel_query = text("""
            SELECT
                k.id, k.code, k.name, k.zone_id, z.name AS zone_name,
                k.status::text AS status, k.type::text AS type,
                k.size_category::text AS size_category, k.capacity,
                k.notes, k.map_x, k.map_y, k.map_w, k.map_h,
                k.map_rotation, k.map_meta,
                COUNT(ks.id) FILTER (WHERE ks.end_at IS NULL) AS occupied_count,
                COALESCE(
                  json_agg(
                    json_build_object(
                      'id', a.id::text,
                      'name', a.name,
                      'species', a.species::text,
                      'photo_url', a.primary_photo_url
                    ) ORDER BY ks.start_at
                  ) FILTER (WHERE ks.end_at IS NULL AND a.id IS NOT NULL),
                  '[]'::json
                ) AS animals_preview
            FROM kennels k
            LEFT JOIN zones z ON z.id = k.zone_id
            LEFT JOIN kennel_stays ks ON ks.kennel_id = k.id
            LEFT JOIN animals a ON a.id = ks.animal_id AND a.deleted_at IS NULL
            WHERE k.id = :kennel_id AND k.organization_id = :org_id AND k.deleted_at IS NULL
            GROUP BY k.id, k.code, k.name, k.zone_id, z.name,
                     k.status, k.type, k.size_category, k.capacity,
                     k.notes, k.map_x, k.map_y, k.map_w, k.map_h,
                     k.map_rotation, k.map_meta
        """)
        result = await session.execute(
            kennel_query, {"kennel_id": kennel_id, "org_id": str(organization_id)}
        )
        row = result.first()
        if not row:
            raise HTTPException(status_code=404, detail="Kennel not found")

        occupied = int(row.occupied_count or 0)
        animals_preview = row.animals_preview if row.animals_preview else []

        return {
            "id": str(row.id),
            "code": row.code,
            "name": row.name,
            "zone_id": str(row.zone_id),
            "zone_name": row.zone_name or "",
            "status": row.status or "available",
            "type": row.type or "indoor",
            "size_category": row.size_category or "medium",
            "capacity": row.capacity or 1,
            "occupied_count": occupied,
            "animals_preview": animals_preview,
            "alerts": _calculate_alerts_from_data(
                row.status or "available", row.type or "indoor", occupied, row.capacity or 1
            ),
            "notes": row.notes,
            "map_x": row.map_x or 0,
            "map_y": row.map_y or 0,
            "map_w": row.map_w or 160,
            "map_h": row.map_h or 120,
            "map_rotation": row.map_rotation,
            "map_meta": row.map_meta,
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"ERROR in get_kennel endpoint: {e}")
        print(f"ERROR traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.post("")
async def create_kennel(
    kennel_data: KennelCreate,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Create a new kennel."""

    try:
        # Create new kennel using service
        kennel = await create_kennel(
            db=session,
            name=kennel_data.name,
            zone_id=kennel_data.zone_id,
            organization_id=organization_id,
            kennel_type=kennel_data.type,
            size_category=kennel_data.size_category,
            capacity=kennel_data.capacity,
            capacity_rules=kennel_data.capacity_rules,
            primary_photo_path=kennel_data.primary_photo_path,
            notes=kennel_data.notes,
        )

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
            "primary_photo_path": kennel.primary_photo_path,
            "notes": kennel.notes,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to create kennel: {str(e)}"
        )
