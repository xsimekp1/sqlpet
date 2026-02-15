"""Organization info endpoints."""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.dependencies.auth import get_current_user, get_current_organization_id
from src.app.api.dependencies.db import get_db
from src.app.models.organization import Organization
from src.app.models.user import User

router = APIRouter(prefix="/organization", tags=["organization"])


class OrganizationResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    timezone: str
    logo_url: Optional[str] = None

    model_config = {"from_attributes": True}


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
