"""API routes for intake management."""

import enum
import uuid
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.dependencies.auth import get_current_user, get_current_organization_id
from src.app.api.dependencies.db import get_db
from src.app.models.intake import Intake, IntakeReason
from src.app.models.user import User
from src.app.models.animal import AnimalStatus

router = APIRouter(prefix="/intakes", tags=["intakes"])


# ── Schemas ──────────────────────────────────────────────────────────────────


class IntakeCreate(BaseModel):
    animal_id: str
    reason: IntakeReason
    intake_date: date
    finder_person_id: Optional[str] = None
    finder_notes: Optional[str] = None
    planned_end_date: Optional[date] = None
    planned_person_id: Optional[str] = None
    funding_source: Optional[str] = None
    funding_notes: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("planned_end_date", mode="before")
    @classmethod
    def validate_hotel_end_date(cls, v, info):
        # Will be validated in model_validator after we know the reason
        return v

    @model_validator(mode="after")
    def validate_hotel_mandatory_end_date(self):
        if self.reason == IntakeReason.HOTEL and self.planned_end_date is None:
            raise ValueError("planned_end_date is required when reason is 'hotel'")
        if (
            self.planned_end_date is not None
            and self.planned_end_date <= self.intake_date
        ):
            raise ValueError("planned_end_date must be after intake_date")
        return self


class IntakeUpdate(BaseModel):
    reason: Optional[IntakeReason] = None
    intake_date: Optional[date] = None
    finder_person_id: Optional[str] = None
    finder_notes: Optional[str] = None
    planned_end_date: Optional[date] = None
    planned_outcome_date: Optional[date] = None
    actual_outcome_date: Optional[date] = None
    planned_person_id: Optional[str] = None
    funding_source: Optional[str] = None
    funding_notes: Optional[str] = None
    notes: Optional[str] = None

    @model_validator(mode="after")
    def validate_hotel_mandatory_end_date(self):
        if self.reason == IntakeReason.HOTEL and self.planned_end_date is None:
            raise ValueError("planned_end_date is required when reason is 'hotel'")
        if self.planned_end_date is not None and self.intake_date is not None:
            if self.planned_end_date <= self.intake_date:
                raise ValueError("planned_end_date must be after intake_date")
        return self


class IntakeResponse(BaseModel):
    id: str
    organization_id: str
    animal_id: str
    animal_name: Optional[str] = None
    animal_species: Optional[str] = None
    reason: str
    intake_date: date
    finder_person_id: Optional[str] = None
    finder_notes: Optional[str] = None
    planned_end_date: Optional[date] = None
    planned_outcome_date: Optional[date] = None
    actual_outcome_date: Optional[date] = None
    planned_person_id: Optional[str] = None
    funding_source: Optional[str] = None
    funding_notes: Optional[str] = None
    notes: Optional[str] = None
    created_by_id: str
    created_at: datetime
    updated_at: datetime


def _to_response(i: Intake, animal=None) -> IntakeResponse:
    return IntakeResponse(
        id=str(i.id),
        organization_id=str(i.organization_id),
        animal_id=str(i.animal_id),
        animal_name=animal.name if animal else None,
        animal_species=animal.species if animal else None,
        reason=i.reason.value if isinstance(i.reason, IntakeReason) else str(i.reason),
        intake_date=i.intake_date,
        finder_person_id=str(i.finder_person_id) if i.finder_person_id else None,
        finder_notes=i.finder_notes,
        planned_end_date=i.planned_end_date,
        planned_outcome_date=i.planned_outcome_date,
        actual_outcome_date=i.actual_outcome_date,
        planned_person_id=str(i.planned_person_id) if i.planned_person_id else None,
        funding_source=i.funding_source,
        funding_notes=i.funding_notes,
        notes=i.notes,
        created_by_id=str(i.created_by_id),
        created_at=i.created_at,
        updated_at=i.updated_at,
    )


# ── Routes ───────────────────────────────────────────────────────────────────


@router.get("", response_model=List[IntakeResponse])
async def list_intakes(
    reason: Optional[str] = Query(None),
    animal_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """List intakes for the current organization."""
    from src.app.models.animal import Animal as AnimalModel

    q = (
        select(Intake, AnimalModel)
        .outerjoin(AnimalModel, AnimalModel.id == Intake.animal_id)
        .where(
            Intake.organization_id == organization_id,
            Intake.deleted_at.is_(None),
        )
    )
    if reason:
        q = q.where(Intake.reason == reason)
    if animal_id:
        try:
            q = q.where(Intake.animal_id == uuid.UUID(animal_id))
        except ValueError:
            pass
    q = q.order_by(Intake.intake_date.desc())
    result = await db.execute(q)
    return [_to_response(i, a) for i, a in result.all()]


@router.post("", response_model=IntakeResponse, status_code=status.HTTP_201_CREATED)
async def create_intake(
    data: IntakeCreate,
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a new intake record."""
    try:
        animal_uuid = uuid.UUID(data.animal_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid animal_id")

    intake = Intake(
        organization_id=organization_id,
        animal_id=animal_uuid,
        reason=data.reason,
        intake_date=data.intake_date,
        finder_person_id=uuid.UUID(data.finder_person_id)
        if data.finder_person_id
        else None,
        finder_notes=data.finder_notes,
        planned_end_date=data.planned_end_date,
        planned_person_id=uuid.UUID(data.planned_person_id)
        if data.planned_person_id
        else None,
        funding_source=data.funding_source,
        funding_notes=data.funding_notes,
        notes=data.notes,
        created_by_id=current_user.id,
    )
    db.add(intake)

    # Update animal status to 'intake'
    from src.app.models.animal import Animal as AnimalModel

    animal_result = await db.execute(
        select(AnimalModel).where(
            AnimalModel.id == animal_uuid,
            AnimalModel.organization_id == organization_id,
        )
    )
    animal = animal_result.scalar_one_or_none()
    if animal:
        if data.reason == IntakeReason.HOTEL:
            animal.status = AnimalStatus.HOTEL
        else:
            animal.status = AnimalStatus.INTAKE

    await db.commit()
    await db.refresh(intake)
    return _to_response(intake)


@router.get("/{intake_id}", response_model=IntakeResponse)
async def get_intake(
    intake_id: str,
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        intake_uuid = uuid.UUID(intake_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid intake_id")

    result = await db.execute(
        select(Intake).where(
            Intake.id == intake_uuid,
            Intake.organization_id == organization_id,
            Intake.deleted_at.is_(None),
        )
    )
    intake = result.scalar_one_or_none()
    if not intake:
        raise HTTPException(status_code=404, detail="Intake not found")
    return _to_response(intake)


@router.put("/{intake_id}", response_model=IntakeResponse)
async def update_intake(
    intake_id: str,
    data: IntakeUpdate,
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        intake_uuid = uuid.UUID(intake_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid intake_id")

    result = await db.execute(
        select(Intake).where(
            Intake.id == intake_uuid,
            Intake.organization_id == organization_id,
            Intake.deleted_at.is_(None),
        )
    )
    intake = result.scalar_one_or_none()
    if not intake:
        raise HTTPException(status_code=404, detail="Intake not found")

    if data.reason is not None:
        intake.reason = data.reason
    if data.intake_date is not None:
        intake.intake_date = data.intake_date
    if data.finder_person_id is not None:
        intake.finder_person_id = (
            uuid.UUID(data.finder_person_id) if data.finder_person_id else None
        )
    if data.finder_notes is not None:
        intake.finder_notes = data.finder_notes
    if data.planned_end_date is not None:
        intake.planned_end_date = data.planned_end_date
    if data.planned_outcome_date is not None:
        intake.planned_outcome_date = data.planned_outcome_date
    if data.actual_outcome_date is not None:
        intake.actual_outcome_date = data.actual_outcome_date
    if data.planned_person_id is not None:
        intake.planned_person_id = (
            uuid.UUID(data.planned_person_id) if data.planned_person_id else None
        )
    if data.funding_source is not None:
        intake.funding_source = data.funding_source
    if data.funding_notes is not None:
        intake.funding_notes = data.funding_notes
    if data.notes is not None:
        intake.notes = data.notes

    await db.commit()
    await db.refresh(intake)
    return _to_response(intake)


@router.delete("/{intake_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_intake(
    intake_id: str,
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        intake_uuid = uuid.UUID(intake_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid intake_id")

    result = await db.execute(
        select(Intake).where(
            Intake.id == intake_uuid,
            Intake.organization_id == organization_id,
            Intake.deleted_at.is_(None),
        )
    )
    intake = result.scalar_one_or_none()
    if not intake:
        raise HTTPException(status_code=404, detail="Intake not found")

    from datetime import datetime as dt

    intake.deleted_at = dt.utcnow()  # type: ignore
    await db.commit()


# ── Close Intake ─────────────────────────────────────────────────────────────


class IntakeOutcome(str, enum.Enum):
    ADOPTED = "adopted"
    DECEASED = "deceased"
    LOST = "lost"
    HOTEL_END = "hotel_end"


class IntakeClose(BaseModel):
    outcome: IntakeOutcome
    notes: Optional[str] = None


_OUTCOME_STATUS_MAP = {
    IntakeOutcome.ADOPTED: AnimalStatus.ADOPTED,
    IntakeOutcome.DECEASED: AnimalStatus.DECEASED,
    IntakeOutcome.LOST: AnimalStatus.ESCAPED,
    IntakeOutcome.HOTEL_END: AnimalStatus.WITH_OWNER,
}


@router.post("/{intake_id}/close", response_model=IntakeResponse)
async def close_intake(
    intake_id: str,
    data: IntakeClose,
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Close an intake by setting the animal status and soft-deleting the intake."""
    try:
        intake_uuid = uuid.UUID(intake_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid intake_id")

    result = await db.execute(
        select(Intake).where(
            Intake.id == intake_uuid,
            Intake.organization_id == organization_id,
            Intake.deleted_at.is_(None),
        )
    )
    intake = result.scalar_one_or_none()
    if not intake:
        raise HTTPException(status_code=404, detail="Intake not found")

    from src.app.models.animal import Animal as AnimalModel

    animal_result = await db.execute(
        select(AnimalModel).where(
            AnimalModel.id == intake.animal_id,
            AnimalModel.organization_id == organization_id,
        )
    )
    animal = animal_result.scalar_one_or_none()
    if animal:
        animal.status = _OUTCOME_STATUS_MAP[data.outcome]  # type: ignore

    if data.notes:
        intake.notes = (intake.notes or "") + f"\n[Close] {data.notes}"

    from datetime import datetime as dt

    intake.deleted_at = dt.utcnow()  # type: ignore

    await db.commit()
    await db.refresh(intake)
    return _to_response(intake)
