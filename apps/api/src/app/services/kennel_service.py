from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.models.animal import Animal
from src.app.models.kennel import Kennel, KennelStay
from src.app.models.user import User


class CapacityError(Exception):
    """Raised when kennel capacity would be exceeded"""

    pass


class NotFoundError(Exception):
    """Raised when entity is not found"""

    pass


class InvalidStateError(Exception):
    """Raised when entity is in invalid state for operation"""

    pass


class ForbiddenError(Exception):
    """Raised when operation is not permitted"""

    pass


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _species_capacity(kennel: Kennel, animal_species: str) -> int:
    """
    Return max capacity for specific species if defined in capacity_rules,
    otherwise fallback to kennel.capacity.
    """
    rules = kennel.capacity_rules or {}
    by_species = rules.get("by_species") or {}
    return int(by_species.get(animal_species, kennel.capacity))


async def _get_active_occupancy(session: AsyncSession, kennel_id: uuid.UUID) -> int:
    """Get current active occupancy for a kennel"""
    q = (
        select(func.count())
        .select_from(KennelStay)
        .where(
            KennelStay.kennel_id == kennel_id,
            KennelStay.end_at.is_(None),
        )
    )
    return int((await session.execute(q)).scalar() or 0)


async def move_animal(
    session: AsyncSession,
    *,
    organization_id: uuid.UUID,
    actor_user_id: uuid.UUID,
    animal_id: uuid.UUID,
    target_kennel_id: uuid.UUID | None,  # None = remove from kennel
    reason: str = "move",
    notes: str | None = None,
    allow_overflow: bool = False,
) -> dict[str, Any]:
    """
    Atomically move animal between kennels with proper locking and capacity checks.

    Args:
        session: SQLAlchemy async session
        organization_id: Current organization
        actor_user_id: User performing the action
        animal_id: Animal to move
        target_kennel_id: Target kennel (None to remove from kennel)
        reason: Reason for move
        notes: Optional notes
        allow_overflow: Allow exceeding capacity (admin only)

    Returns:
        Dict with operation result
    """
    # 1) Lock animal row to prevent concurrent moves
    animal_q = (
        select(Animal)
        .where(Animal.id == animal_id, Animal.organization_id == organization_id)
        .with_for_update()
    )
    animal = (await session.execute(animal_q)).scalar_one_or_none()
    if not animal:
        raise NotFoundError("Animal not found")

    # 2) Find and lock active stay (if any)
    active_stay_q = (
        select(KennelStay)
        .where(
            KennelStay.organization_id == organization_id,
            KennelStay.animal_id == animal_id,
            KennelStay.end_at.is_(None),
        )
        .with_for_update()
    )
    active_stay = (await session.execute(active_stay_q)).scalar_one_or_none()

    prev_kennel_id = active_stay.kennel_id if active_stay else None

    # No-op guard - moving to same kennel
    if target_kennel_id is not None and prev_kennel_id == target_kennel_id:
        return {
            "status": "noop",
            "animal_id": str(animal_id),
            "kennel_id": str(target_kennel_id),
        }

    # 3) End current stay if exists
    if active_stay:
        active_stay.end_at = _now()

        # 4) Remove from kennel = just clear current_kennel_id
        # TODO: Re-enable after adding column to database
        # if target_kennel_id is None:
        #     animal.current_kennel_id = None
        return {
            "status": "removed",
            "animal_id": str(animal_id),
            "from": str(prev_kennel_id) if prev_kennel_id else None,
        }

    # 5) Lock target kennel row
    kennel_q = (
        select(Kennel)
        .where(Kennel.id == target_kennel_id, Kennel.organization_id == organization_id)
        .with_for_update()
    )
    kennel = (await session.execute(kennel_q)).scalar_one_or_none()
    if not kennel:
        raise NotFoundError("Target kennel not found")

    if kennel.status in ("maintenance", "closed"):
        raise InvalidStateError(f"Kennel is not available (status={kennel.status})")

    # 6) Check capacity (count active stays)
    occupied = await _get_active_occupancy(session, kennel.id)
    max_for_species = _species_capacity(kennel, animal.species)

    if not allow_overflow and occupied >= max_for_species:
        raise CapacityError(f"Kennel capacity exceeded ({occupied}/{max_for_species})")

    # 7) Create new stay
    new_stay = KennelStay(
        organization_id=organization_id,
        kennel_id=kennel.id,
        animal_id=animal.id,
        start_at=_now(),
        end_at=None,
        reason=reason,
        notes=notes,
        moved_by=actor_user_id,
    )
    session.add(new_stay)

    # 8) Update cache on animal
    # TODO: Re-enable after adding column to database
    # animal.current_kennel_id = kennel.id

    return {
        "status": "moved",
        "animal_id": str(animal.id),
        "from": str(prev_kennel_id) if prev_kennel_id else None,
        "to": str(kennel.id),
        "occupied": occupied + 1,
        "capacity": max_for_species,
    }
