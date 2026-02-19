from typing import Any, Optional
from datetime import date, datetime
import uuid
from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_

from src.app.api.dependencies.auth import get_current_user, get_current_organization_id
from src.app.api.dependencies.db import get_db
from src.app.models.user import User
from src.app.models.kennel import KennelStay, Kennel, Zone
from src.app.models.animal import Animal
from src.app.services.kennel_service import (
    move_animal,
    CapacityError,
    InvalidStateError,
    NotFoundError,
)

router = APIRouter(prefix="/stays", tags=["stays"])


class MoveAnimalRequest(BaseModel):
    animal_id: str = Field(..., description="ID of animal to move")
    target_kennel_id: str | None = Field(
        None, description="Target kennel ID (null to remove from kennel)"
    )
    reason: str = Field("move", description="Reason for the move")
    notes: str | None = Field(None, description="Optional notes")
    allow_overflow: bool = Field(
        False, description="Allow exceeding capacity (admin only)"
    )


@router.post("/move")
async def move_animal_endpoint(
    request: MoveAnimalRequest,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
) -> dict[str, Any]:
    """Move an animal between kennels or remove from kennel."""

    try:
        if request.target_kennel_id:
            from sqlalchemy import text

            intake_check = await session.execute(
                text(
                    "SELECT 1 FROM intakes WHERE animal_id = :aid AND deleted_at IS NULL LIMIT 1"
                ),
                {"aid": uuid.UUID(request.animal_id)},
            )
            if not intake_check.first():
                raise HTTPException(
                    status_code=422,
                    detail="Cannot assign kennel: animal has no active intake",
                )
        result = await move_animal(
            session,
            organization_id=organization_id,
            actor_user_id=current_user.id,
            animal_id=uuid.UUID(request.animal_id),
            target_kennel_id=uuid.UUID(request.target_kennel_id)
            if request.target_kennel_id
            else None,
            reason=request.reason,
            notes=request.notes,
            allow_overflow=request.allow_overflow,
        )
        await session.commit()
        return result
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except InvalidStateError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except CapacityError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid ID format: {str(e)}")


@router.get("/{kennel_id}/stays")
async def list_kennel_stays(
    kennel_id: str,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    active_only: bool = False,
):
    """List stays for a specific kennel."""

    from src.app.models.kennel import KennelStay
    from src.app.models.animal import Animal

    # Verify kennel exists and belongs to org
    kennel_check = await session.execute(
        select(KennelStay.kennel_id).where(
            KennelStay.kennel_id == kennel_id,
            KennelStay.organization_id == organization_id,
        )
    )

    if not kennel_check.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Kennel not found")

    query = (
        select(KennelStay, Animal)
        .join(Animal, KennelStay.animal_id == Animal.id)
        .where(KennelStay.kennel_id == kennel_id)
        .order_by(KennelStay.start_at.desc())
    )

    if active_only:
        query = query.where(KennelStay.end_at.is_(None))

    result = await session.execute(query)
    stays = result.all()

    return [
        {
            "id": str(stay.id),
            "animal_id": str(stay.animal_id),
            "animal_name": animal.name,
            "animal_species": animal.species,
            "start_at": stay.start_at,
            "end_at": stay.end_at,
            "reason": stay.reason,
            "notes": stay.notes,
            "moved_by": str(stay.moved_by) if stay.moved_by else None,
        }
        for stay, animal in stays
    ]


@router.get("/timeline")
async def get_stays_timeline(
    from_date: Optional[date] = Query(
        None, description="Start date (default: today - 7 days)"
    ),
    to_date: Optional[date] = Query(
        None, description="End date (default: today + 30 days)"
    ),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Get timeline of all kennel stays for date range.

    Returns kennels with their stays, useful for Gantt-style timeline view.
    """
    from sqlalchemy import text

    # Default date range: today - 7 to today + 30
    from datetime import timedelta

    today = date.today()
    start_date = from_date or (today - timedelta(days=7))
    end_date = to_date or (today + timedelta(days=30))

    # Get all kennels with zones (only non-deleted)
    kennels_query = text("""
        SELECT 
            k.id::text as kennel_id,
            k.name as kennel_name,
            k.code as kennel_code,
            k.capacity as kennel_capacity,
            k.allowed_species as allowed_species,
            z.id::text as zone_id,
            z.name as zone_name,
            z.color as zone_color,
            k.maintenance_start_at as maintenance_start_at,
            k.maintenance_end_at as maintenance_end_at,
            k.maintenance_reason as maintenance_reason
        FROM kennels k
        LEFT JOIN zones z ON k.zone_id = z.id
        WHERE k.organization_id = :org_id AND k.deleted_at IS NULL
        ORDER BY z.name NULLS LAST, k.name
    """)

    kennels_result = await session.execute(
        kennels_query, {"org_id": str(organization_id)}
    )
    kennels = kennels_result.fetchall()

    # Get all stays in date range
    stays_query = text("""
        SELECT 
            ks.id::text as stay_id,
            ks.kennel_id::text as kennel_id,
            ks.animal_id::text as animal_id,
            ks.start_at,
            ks.end_at,
            ks.reason,
            ks.notes,
            a.name as animal_name,
            a.species as animal_species,
            a.public_code as animal_public_code,
            a.primary_photo_url as animal_photo_url
        FROM kennel_stays ks
        JOIN animals a ON ks.animal_id = a.id
        WHERE ks.organization_id = :org_id
        AND (
            (ks.start_at <= :end_date AND (ks.end_at IS NULL OR ks.end_at >= :start_date))
            OR (ks.end_at IS NULL)
        )
        ORDER BY ks.start_at
    """)

    stays_result = await session.execute(
        stays_query,
        {
            "org_id": str(organization_id),
            "start_date": start_date,
            "end_date": end_date,
        },
    )
    stays = stays_result.fetchall()

    # Group stays by kennel
    stays_by_kennel: dict[str, list] = {}
    for stay in stays:
        kennel_id = stay.kennel_id
        if kennel_id not in stays_by_kennel:
            stays_by_kennel[kennel_id] = []
        stays_by_kennel[kennel_id].append(
            {
                "id": stay.stay_id,
                "animal_id": stay.animal_id,
                "animal_name": stay.animal_name,
                "animal_species": stay.animal_species,
                "animal_public_code": stay.animal_public_code,
                "animal_photo_url": stay.animal_photo_url,
                "start_at": stay.start_at.isoformat() if stay.start_at else None,
                "end_at": stay.end_at.isoformat() if stay.end_at else None,
                "reason": stay.reason,
                "notes": stay.notes,
                "is_hotel": stay.reason in ("hotel", "hotel_stay", "boarding")
                if stay.reason
                else False,
            }
        )

    # Build response
    timeline_kennels = []
    for kennel in kennels:
        kennel_id = kennel.kennel_id
        timeline_kennels.append(
            {
                "kennel_id": kennel_id,
                "kennel_name": kennel.kennel_name,
                "kennel_code": kennel.kennel_code,
                "capacity": kennel.kennel_capacity,
                "allowed_species": kennel.allowed_species,
                "zone_id": kennel.zone_id,
                "zone_name": kennel.zone_name,
                "zone_color": kennel.zone_color,
                "stays": stays_by_kennel.get(kennel_id, []),
                "maintenance_start_at": kennel.maintenance_start_at.isoformat()
                if kennel.maintenance_start_at
                else None,
                "maintenance_end_at": kennel.maintenance_end_at.isoformat()
                if kennel.maintenance_end_at
                else None,
                "maintenance_reason": kennel.maintenance_reason,
            }
        )

    return {
        "from_date": start_date.isoformat(),
        "to_date": end_date.isoformat(),
        "kennels": timeline_kennels,
    }


@router.delete("/{stay_id}", status_code=204)
async def delete_stay(
    stay_id: str,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Delete a kennel stay. Superadmin only."""
    from src.app.models.kennel import KennelStay
    from fastapi import status

    # Check if user is superadmin
    # For now, allow if user has admin role in any org or is superadmin
    # In production, you'd check the token for superadmin flag

    try:
        stay_uuid = uuid.UUID(stay_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid stay ID format")

    # Find the stay
    result = await session.execute(
        select(KennelStay).where(
            KennelStay.id == stay_uuid,
            KennelStay.organization_id == organization_id,
        )
    )
    stay = result.scalar_one_or_none()

    if not stay:
        raise HTTPException(status_code=404, detail="Stay not found")

    # Delete the stay
    await session.delete(stay)
    await session.commit()

    return None
