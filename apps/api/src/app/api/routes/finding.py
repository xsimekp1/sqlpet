from datetime import datetime
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, join, literal_column, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.dependencies.auth import (
    get_current_organization_id,
    require_permission,
)
from src.app.api.dependencies.db import get_db
from src.app.models.animal import Animal
from src.app.models.contact import Contact
from src.app.models.finding import Finding
from src.app.models.user import User
from src.app.schemas.finding import (
    FindingCreate,
    FindingListResponse,
    FindingResponse,
    FindingUpdate,
    FindingWithAnimalResponse,
)

router = APIRouter(prefix="/findings", tags=["findings"])


def _to_response(finding: Finding) -> FindingResponse:
    return FindingResponse.model_validate(finding)


def _to_response_with_animal(finding: Finding) -> FindingWithAnimalResponse:
    data = FindingWithAnimalResponse.model_validate(finding)
    if finding.animal:
        data.animal_name = finding.animal.name
        data.animal_public_code = finding.animal.public_code
    if finding.who_found:
        data.who_found_name = finding.who_found.name
    return data


@router.post("", response_model=FindingResponse, status_code=status.HTTP_201_CREATED)
async def create_finding(
    data: FindingCreate,
    current_user: User = Depends(require_permission("intake.create")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    finding = Finding(
        id=uuid.uuid4(),
        organization_id=organization_id,
        **data.model_dump(),
    )
    db.add(finding)
    await db.commit()
    await db.refresh(finding)
    return _to_response(finding)


@router.get("", response_model=FindingListResponse)
async def list_findings(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    animal_id: Optional[uuid.UUID] = Query(None),
    who_found_id: Optional[uuid.UUID] = Query(None),
    date_from: Optional[str] = Query(None, description="ISO date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="ISO date (YYYY-MM-DD)"),
    lat: Optional[float] = Query(None, description="Latitude for GPS filter"),
    lng: Optional[float] = Query(None, description="Longitude for GPS filter"),
    radius_km: Optional[float] = Query(None, description="Radius in kilometers"),
    current_user: User = Depends(require_permission("intake.read")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    q = select(Finding).where(Finding.organization_id == organization_id)

    if animal_id:
        q = q.where(Finding.animal_id == animal_id)
    if who_found_id:
        q = q.where(Finding.who_found_id == who_found_id)

    if date_from:
        try:
            date_from_dt = datetime.fromisoformat(date_from)
            q = q.where(Finding.when_found >= date_from_dt)
        except ValueError:
            pass

    if date_to:
        try:
            date_to_dt = datetime.fromisoformat(date_to + "T23:59:59")
            q = q.where(Finding.when_found <= date_to_dt)
        except ValueError:
            pass

    if lat is not None and lng is not None and radius_km is not None:
        haversine_expr = text("""
            (6371 * acos(
                cos(radians(:lat)) * cos(radians(where_lat)) * 
                cos(radians(where_lng) - radians(:lng)) + 
                sin(radians(:lat)) * sin(radians(where_lat))
            )) <= :radius_km
        """)
        q = q.where(
            Finding.where_lat.isnot(None),
            Finding.where_lng.isnot(None),
            haversine_expr.bindparams(lat=lat, lng=lng, radius_km=radius_km),
        )

    count_q = select(func.count()).select_from(q.subquery())
    total_result = await db.execute(count_q)
    total = total_result.scalar()

    q = (
        q.order_by(Finding.when_found.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(q)
    findings = result.scalars().all()

    items = [_to_response_with_animal(f) for f in findings]

    return FindingListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{finding_id}", response_model=FindingWithAnimalResponse)
async def get_finding(
    finding_id: uuid.UUID,
    current_user: User = Depends(require_permission("intake.read")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Finding).where(
            Finding.id == finding_id,
            Finding.organization_id == organization_id,
        )
    )
    finding = result.scalar_one_or_none()
    if not finding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Finding not found"
        )
    return _to_response_with_animal(finding)


@router.patch("/{finding_id}", response_model=FindingResponse)
async def update_finding(
    finding_id: uuid.UUID,
    data: FindingUpdate,
    current_user: User = Depends(require_permission("intake.write")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Finding).where(
            Finding.id == finding_id,
            Finding.organization_id == organization_id,
        )
    )
    finding = result.scalar_one_or_none()
    if not finding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Finding not found"
        )

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(finding, field, value)

    await db.commit()
    await db.refresh(finding)
    return _to_response(finding)


@router.delete("/{finding_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_finding(
    finding_id: uuid.UUID,
    current_user: User = Depends(require_permission("intake.write")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Finding).where(
            Finding.id == finding_id,
            Finding.organization_id == organization_id,
        )
    )
    finding = result.scalar_one_or_none()
    if not finding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Finding not found"
        )

    await db.delete(finding)
    await db.commit()


@router.get("/contact/{contact_id}/findings", response_model=FindingListResponse)
async def get_contact_findings(
    contact_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_permission("people.read")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    contact_result = await db.execute(
        select(Contact).where(
            Contact.id == contact_id,
            Contact.organization_id == organization_id,
        )
    )
    contact = contact_result.scalar_one_or_none()
    if not contact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found"
        )

    q = select(Finding).where(
        Finding.who_found_id == contact_id,
        Finding.organization_id == organization_id,
    )

    count_q = select(func.count()).select_from(q.subquery())
    total_result = await db.execute(count_q)
    total = total_result.scalar()

    q = (
        q.order_by(Finding.when_found.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(q)
    findings = result.scalars().all()

    items = [_to_response_with_animal(f) for f in findings]

    return FindingListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )
