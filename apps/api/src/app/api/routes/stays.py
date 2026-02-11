from typing import Any
import uuid
from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.app.api.dependencies.auth import get_current_user, get_current_organization_id
from src.app.api.dependencies.db import get_db
from src.app.models.user import User
from src.app.models.kennel import KennelStay
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
        async with session.begin():
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
