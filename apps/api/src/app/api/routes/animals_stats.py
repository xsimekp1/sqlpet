"""API routes for animal statistics - optimized counts."""

import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.dependencies.auth import get_current_user, get_current_organization_id
from src.app.api.dependencies.db import get_db
from src.app.models.user import User


router = APIRouter(prefix="/animals", tags=["animals"])


class AnimalStatsResponse(BaseModel):
    total: int
    available: int
    intake: int
    quarantine: int


@router.get("/stats/counts", response_model=AnimalStatsResponse)
async def get_animal_counts(
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Get animal counts by status in a single optimized query.

    Returns counts for all statuses in one DB query:
    - total: All animals (non-deleted)
    - available: Animals with status 'available'
    - intake: Animals with status 'intake'
    - quarantine: Animals with status 'quarantine'

    This replaces 4 separate API calls to /animals with status filter.
    """
    sql = text("""
        SELECT 
            COUNT(*) FILTER (WHERE deleted_at IS NULL) as total,
            COUNT(*) FILTER (WHERE status = 'available' AND deleted_at IS NULL) as available,
            COUNT(*) FILTER (WHERE status = 'intake' AND deleted_at IS NULL) as intake,
            COUNT(*) FILTER (WHERE status = 'quarantine' AND deleted_at IS NULL) as quarantine
        FROM animals 
        WHERE organization_id = :org_id
    """)
    result = await db.execute(sql, {"org_id": str(organization_id)})
    row = result.fetchone()

    return AnimalStatsResponse(
        total=row[0] or 0,
        available=row[1] or 0,
        intake=row[2] or 0,
        quarantine=row[3] or 0,
    )
