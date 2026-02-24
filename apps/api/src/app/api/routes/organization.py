"""Organization info endpoints."""

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.dependencies.auth import (
    get_current_user,
    get_current_organization_id,
    require_permission,
)
from src.app.api.dependencies.db import get_db
from src.app.models.organization import Organization
from src.app.models.user import User
from src.app.schemas.org_settings import OrgSettings, get_org_settings
from src.app.services.audit_service import AuditService

router = APIRouter(prefix="/organization", tags=["organization"])


class OrganizationResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    timezone: str
    logo_url: Optional[str] = None
    hotel_price_per_day: Optional[float] = None
    registration_number: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    capacity_dogs: Optional[int] = None
    capacity_cats: Optional[int] = None
    capacity_rabbits: Optional[int] = None
    capacity_small: Optional[int] = None
    capacity_birds: Optional[int] = None
    settings: Optional[dict] = None
    onboarding_completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class OrganizationUpdate(BaseModel):
    name: Optional[str] = None
    timezone: Optional[str] = None
    logo_url: Optional[str] = None
    hotel_price_per_day: Optional[float] = None
    registration_number: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    capacity_dogs: Optional[int] = None
    capacity_cats: Optional[int] = None
    capacity_rabbits: Optional[int] = None
    capacity_small: Optional[int] = None
    capacity_birds: Optional[int] = None


@router.get("/current", response_model=OrganizationResponse)
async def get_current_organization(
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Return basic info about the currently selected organization."""
    org = await db.get(Organization, organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


@router.patch("/current", response_model=OrganizationResponse)
async def update_current_organization(
    data: OrganizationUpdate,
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Update the current organization's settings."""
    org = await db.get(Organization, organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(org, field, value)

    await db.commit()
    await db.refresh(org)
    return org


@router.get("/settings", response_model=OrgSettings)
async def get_organization_settings(
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Return parsed org settings with defaults filled in (readable by any org member)."""
    org = await db.get(Organization, organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return get_org_settings(org)


@router.put("/settings", response_model=OrgSettings)
async def update_organization_settings(
    data: OrgSettings,
    current_user: User = Depends(require_permission("organizations.manage")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Validate and persist org settings JSONB. Requires organizations.manage permission."""
    org = await db.get(Organization, organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    before = org.settings or {}
    org.settings = data.model_dump()

    audit = AuditService(db)
    await audit.log_action(
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="update",
        entity_type="organization_settings",
        entity_id=organization_id,
        before=before,
        after=org.settings,
    )

    await db.commit()
    await db.refresh(org)
    return get_org_settings(org)


@router.post("/onboarding/complete", status_code=204)
async def complete_onboarding(
    current_user: User = Depends(require_permission("organizations.manage")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Mark onboarding as completed. Requires organizations.manage permission."""
    org = await db.get(Organization, organization_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    org.onboarding_completed_at = datetime.now(timezone.utc)

    audit = AuditService(db)
    await audit.log_action(
        organization_id=organization_id,
        actor_user_id=current_user.id,
        action="onboarding_complete",
        entity_type="organization_settings",
        entity_id=organization_id,
    )

    await db.commit()
