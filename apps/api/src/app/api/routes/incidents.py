"""API routes for animal incidents (escapes, injuries, etc.)."""

import uuid
from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.dependencies.auth import get_current_user, get_current_organization_id
from src.app.api.dependencies.db import get_db
from src.app.models.animal import Animal, AnimalStatus
from src.app.models.incident import AnimalIncident
from src.app.models.user import User

router = APIRouter(prefix="/incidents", tags=["incidents"])


class IncidentCreate(BaseModel):
    animal_id: uuid.UUID
    incident_type: str  # 'escape', 'injury', 'illness', 'other'
    incident_date: date
    description: Optional[str] = None


class IncidentResponse(BaseModel):
    id: uuid.UUID
    animal_id: uuid.UUID
    incident_type: str
    incident_date: date
    description: Optional[str]
    resolved: bool
    resolved_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


@router.post("", response_model=IncidentResponse)
async def create_incident(
    data: IncidentCreate,
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Record a new animal incident. For escape incidents, sets animal.status = 'escaped'."""
    # Verify animal belongs to org
    result = await db.execute(
        select(Animal).where(
            and_(Animal.id == data.animal_id, Animal.organization_id == organization_id)
        )
    )
    animal = result.scalar_one_or_none()
    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")

    # For escape incidents: update animal status
    if data.incident_type == "escape":
        animal.status = AnimalStatus.ESCAPED

    incident = AnimalIncident(
        organization_id=organization_id,
        animal_id=data.animal_id,
        incident_type=data.incident_type,
        incident_date=data.incident_date,
        description=data.description,
        created_by_id=current_user.id,
    )
    db.add(incident)
    await db.commit()
    await db.refresh(incident)
    return incident


@router.get("", response_model=List[IncidentResponse])
async def list_incidents(
    animal_id: Optional[uuid.UUID] = None,
    incident_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """List incidents for the organization, optionally filtered by animal or type."""
    stmt = select(AnimalIncident).where(AnimalIncident.organization_id == organization_id)
    if animal_id:
        stmt = stmt.where(AnimalIncident.animal_id == animal_id)
    if incident_type:
        stmt = stmt.where(AnimalIncident.incident_type == incident_type)
    stmt = stmt.order_by(AnimalIncident.incident_date.desc())
    result = await db.execute(stmt)
    return result.scalars().all()
