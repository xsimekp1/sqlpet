from datetime import datetime, date
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
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
from src.app.models.intake import Intake, IntakeReason
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
    current_user: User = Depends(require_permission("reports.run")),
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
    current_user: User = Depends(require_permission("reports.run")),
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
    current_user: User = Depends(require_permission("reports.run")),
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
    current_user: User = Depends(require_permission("reports.run")),
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
    current_user: User = Depends(require_permission("reports.run")),
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


class FindingWithIntakeResponse(BaseModel):
    finding_id: uuid.UUID
    animal_id: uuid.UUID
    animal_name: str
    animal_public_code: str
    species: str
    when_found: datetime
    where_lat: float | None
    where_lng: float | None
    who_found_name: str | None
    intake_date: date
    planned_end_date: date | None
    actual_outcome_date: date | None
    kennel_name: str | None
    kennel_code: str | None
    is_current: bool


class FindingsWithIntakesResponse(BaseModel):
    current: list[FindingWithIntakeResponse]
    past: list[FindingWithIntakeResponse]


@router.get("/with-intakes", response_model=FindingsWithIntakesResponse)
async def get_findings_with_intakes(
    current_user: User = Depends(require_permission("animals.read")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Get findings with intake info, split into current and past."""
    today = date.today()

    query = text("""
        SELECT 
            f.id as finding_id,
            a.id as animal_id,
            a.name as animal_name,
            a.public_code as animal_public_code,
            a.species as species,
            f.when_found as when_found,
            f.where_lat as where_lat,
            f.where_lng as where_lng,
            c.name as who_found_name,
            i.intake_date as intake_date,
            i.planned_end_date as planned_end_date,
            i.actual_outcome_date as actual_outcome_date,
            k.name as kennel_name,
            k.code as kennel_code,
            CASE 
                WHEN i.actual_outcome_date IS NULL THEN TRUE
                WHEN i.actual_outcome_date > :today THEN TRUE
                ELSE FALSE
            END as is_current
        FROM findings f
        JOIN intakes i ON f.animal_id = i.animal_id AND i.reason = 'found' AND i.deleted_at IS NULL
        JOIN animals a ON f.animal_id = a.id
        LEFT JOIN contacts c ON f.who_found_id = c.id
        LEFT JOIN kennels k ON i.kennel_id = k.id
        WHERE f.organization_id = :org_id AND f.animal_id IS NOT NULL
        ORDER BY i.intake_date DESC
    """)

    result = await db.execute(query, {"org_id": str(organization_id), "today": today})
    rows = result.fetchall()

    current = []
    past = []

    for row in rows:
        finding_data = FindingWithIntakeResponse(
            finding_id=row.finding_id,
            animal_id=row.animal_id,
            animal_name=row.animal_name,
            animal_public_code=row.animal_public_code,
            species=row.species,
            when_found=row.when_found,
            where_lat=row.where_lat,
            where_lng=row.where_lng,
            who_found_name=row.who_found_name,
            intake_date=row.intake_date,
            planned_end_date=row.planned_end_date,
            actual_outcome_date=row.actual_outcome_date,
            kennel_name=row.kennel_name,
            kennel_code=row.kennel_code,
            is_current=bool(row.is_current),
        )
        if finding_data.is_current:
            current.append(finding_data)
        else:
            past.append(finding_data)

    return FindingsWithIntakesResponse(current=current, past=past)


# ─── Map Data ──────────────────────────────────────────────────────────────────


class FindingMapData(BaseModel):
    id: uuid.UUID
    animal_id: uuid.UUID | None
    animal_name: str | None
    animal_public_code: str | None
    species: str | None
    when_found: datetime | None
    where_lat: float | None
    where_lng: float | None
    status: str  # "current" or "past"


class OrganizationLocation(BaseModel):
    lat: float | None
    lng: float | None
    name: str | None


class FindingsMapResponse(BaseModel):
    organization: OrganizationLocation
    findings: list[FindingMapData]


@router.get("/map-data", response_model=FindingsMapResponse)
async def get_findings_map_data(
    current_user: User = Depends(require_permission("animals.read")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Get findings with GPS coordinates for map display."""
    print(f"[DEBUG] get_findings_map_data called, org_id={organization_id}")

    # Get organization location - simplified query
    org_result = await db.execute(
        text("SELECT lat, lng, name FROM organizations WHERE id = :org_id"),
        {"org_id": str(organization_id)},
    )
    org_row = org_result.fetchone()
    print(f"[DEBUG] org_row: {org_row}")

    # Simple approach - return empty if no data
    return FindingsMapResponse(
        organization=OrganizationLocation(
            lat=float(org_row[0]) if org_row and org_row[0] else None,
            lng=float(org_row[1]) if org_row and org_row[1] else None,
            name=org_row[2] if org_row else None,
        ),
        findings=[],
    )

    # Get findings with coordinates - step 1: just id
    findings_query = text("""
        SELECT f.id as finding_id
        FROM findings f
        WHERE f.organization_id = :org_id 
          AND f.where_lat IS NOT NULL 
          AND f.where_lng IS NOT NULL
    """)

    findings_result = await db.execute(findings_query, {"org_id": str(organization_id)})
    rows = findings_result.fetchall()
    print(f"[DEBUG] Found {len(rows)} findings")

    findings = []
    for row in rows:
        findings.append(
            FindingMapData(
                id=uuid.UUID(str(row.finding_id)),
                animal_id=None,
                animal_name=None,
                animal_public_code=None,
                species=None,
                when_found=None,
                where_lat=None,
                where_lng=None,
                status="current",
            )
        )

    return FindingsMapResponse(organization=organization, findings=findings)
