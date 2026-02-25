"""Public API routes - no authentication required."""

from typing import List

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.dependencies.db import get_db
from src.app.models.file import DefaultAnimalImage

router = APIRouter(prefix="/api/public", tags=["public"])


class DefaultImageResponse(BaseModel):
    id: str
    species: str
    breed_id: str | None
    color_pattern: str | None
    image_url: str  # thumbnail or public_url


@router.get("/default-images/random", response_model=List[DefaultImageResponse])
async def get_random_default_images(
    count: int = Query(default=12, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """
    Get random default animal images (thumbnails) for landing page.
    No authentication required.
    """
    # Get random images - use thumbnail_url if available, fallback to public_url
    result = await db.execute(
        select(DefaultAnimalImage)
        .where(DefaultAnimalImage.is_active == True)
        .order_by(func.random())
        .limit(count)
    )
    images = result.scalars().all()

    return [
        DefaultImageResponse(
            id=str(img.id),
            species=img.species,
            breed_id=str(img.breed_id) if img.breed_id else None,
            color_pattern=img.color_pattern,
            image_url=img.thumbnail_url or img.public_url,
        )
        for img in images
    ]
