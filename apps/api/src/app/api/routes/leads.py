import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.dependencies.db import get_db
from src.app.models.lead import Lead
from src.app.models.user import User
from src.app.schemas.lead import LeadCreate, LeadResponse, LeadUpdate
from src.app.api.dependencies.auth import require_permission, get_current_user

router = APIRouter(prefix="/leads", tags=["leads"])


@router.post("", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
async def create_lead(
    data: LeadCreate,
    db: AsyncSession = Depends(get_db),
):
    # Validate: at least one of email or phone must be provided
    if not data.email and not data.phone:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Email nebo telefon musí být vyplněn",
        )

    lead = Lead(
        id=uuid.uuid4(),
        name=data.name,
        email=data.email,
        phone=data.phone,
        interest=data.interest,
        shelter_name=data.shelter_name,
        notes=data.notes,
    )
    db.add(lead)
    await db.commit()
    await db.refresh(lead)
    return lead


@router.get("", response_model=list[LeadResponse])
async def list_leads(
    include_processed: bool = False,
    current_user: User = Depends(require_permission("admin.read")),
    db: AsyncSession = Depends(get_db),
):
    q = select(Lead).order_by(Lead.created_at.desc())
    if not include_processed:
        q = q.where(Lead.is_processed == False)
    result = await db.execute(q)
    return result.scalars().all()


@router.get("/count")
async def get_leads_count(
    current_user: User = Depends(require_permission("admin.read")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(
            func.count(Lead.id).label("total"),
            func.count(Lead.id).filter(Lead.is_processed == False).label("unprocessed"),
        )
    )
    row = result.one()
    return {"total": row.total, "unprocessed": row.unprocessed}


@router.patch("/{lead_id}", response_model=LeadResponse)
async def update_lead(
    lead_id: uuid.UUID,
    data: LeadUpdate,
    current_user: User = Depends(require_permission("admin.write")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    if data.is_processed is not None:
        lead.is_processed = data.is_processed
    if data.notes is not None:
        lead.notes = data.notes

    await db.commit()
    await db.refresh(lead)
    return lead
