import uuid
from io import BytesIO
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.dependencies.auth import get_current_user
from src.app.api.dependencies.db import get_db
from src.app.models.breed import Breed
from src.app.models.file import DefaultAnimalImage
from src.app.models.user import User
from src.app.services.file_upload_service import FileUploadService
from src.app.services.supabase_storage_service import supabase_storage_service

router = APIRouter(prefix="/admin", tags=["admin"])


class DefaultImageResponse(BaseModel):
    id: str
    species: str
    breed_id: Optional[str] = None
    breed_name: Optional[str] = None
    color_pattern: Optional[str] = None
    public_url: str
    storage_path: str
    filename_pattern: Optional[str] = None
    is_active: bool
    priority: int
    source: str
    created_at: str


@router.get("/default-images", response_model=List[DefaultImageResponse])
async def list_default_images(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(DefaultAnimalImage).order_by(
            DefaultAnimalImage.species, DefaultAnimalImage.created_at.desc()
        )
    )
    images = result.scalars().all()

    response = []
    for img in images:
        breed_name = None
        if img.breed_id:
            breed_result = await db.execute(
                select(Breed).where(Breed.id == img.breed_id)
            )
            breed_obj = breed_result.scalar_one_or_none()
            breed_name = breed_obj.name if breed_obj else None

        response.append(
            DefaultImageResponse(
                id=str(img.id),
                species=img.species,
                breed_id=str(img.breed_id) if img.breed_id else None,
                breed_name=breed_name,
                color_pattern=img.color_pattern,
                public_url=img.public_url,
                storage_path=img.storage_path,
                filename_pattern=img.filename_pattern,
                is_active=img.is_active,
                priority=img.priority,
                source=img.source,
                created_at=img.created_at.isoformat(),
            )
        )

    return response


@router.get("/default-images/colors")
async def list_default_image_colors(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        text(
            "SELECT DISTINCT color_pattern FROM default_animal_images "
            "WHERE color_pattern IS NOT NULL ORDER BY color_pattern"
        )
    )
    colors = [row[0] for row in result.fetchall()]
    return colors


@router.post("/default-images", response_model=DefaultImageResponse, status_code=201)
async def upload_default_image(
    file: UploadFile = File(...),
    species: str = Form(...),
    breed_id: Optional[str] = Form(None),
    color_pattern: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Validate and read file
    file_content, content_type = await FileUploadService.process_upload(
        file=file,
        organization_id="default",
    )

    # Check image dimensions (must be square)
    try:
        from PIL import Image

        img = Image.open(BytesIO(file_content))
        w, h = img.size
        if w != h:
            raise HTTPException(
                status_code=400,
                detail=f"Image must be square (width == height). Got {w}x{h}.",
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=400, detail=f"Could not read image dimensions: {str(e)}"
        )

    # Resolve breed
    breed_uuid = None
    breed_name = None
    breed_slug = None
    if breed_id:
        try:
            breed_uuid = uuid.UUID(breed_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid breed_id format")

        breed_result = await db.execute(select(Breed).where(Breed.id == breed_uuid))
        breed_obj = breed_result.scalar_one_or_none()
        if not breed_obj:
            raise HTTPException(status_code=404, detail="Breed not found")
        breed_name = breed_obj.name
        breed_slug = breed_obj.name.lower().replace(" ", "_")

    # Build filename pattern
    ext = (
        file.filename.rsplit(".", 1)[-1].lower()
        if file.filename and "." in file.filename
        else "png"
    )
    parts = [species]
    if breed_slug:
        parts.append(breed_slug)
    if color_pattern:
        parts.append(color_pattern)
    filename_pattern = "_".join(parts) + f".{ext}"

    # Upload to Supabase
    file_url, storage_path = await supabase_storage_service.upload_file(
        file_content=BytesIO(file_content),
        filename=filename_pattern,
        content_type=content_type,
        organization_id="default",
        bucket=supabase_storage_service.default_images_bucket,
        path_prefix="default-images",
    )

    # Create DB record
    default_image = DefaultAnimalImage(
        species=species,
        breed_id=breed_uuid,
        color_pattern=color_pattern or None,
        storage_path=storage_path,
        public_url=file_url,
        filename_pattern=filename_pattern,
        is_active=True,
        priority=10,
        source="uploaded",
    )
    db.add(default_image)
    await db.commit()
    await db.refresh(default_image)

    return DefaultImageResponse(
        id=str(default_image.id),
        species=default_image.species,
        breed_id=str(default_image.breed_id) if default_image.breed_id else None,
        breed_name=breed_name,
        color_pattern=default_image.color_pattern,
        public_url=default_image.public_url,
        storage_path=default_image.storage_path,
        filename_pattern=default_image.filename_pattern,
        is_active=default_image.is_active,
        priority=default_image.priority,
        source=default_image.source,
        created_at=default_image.created_at.isoformat(),
    )


@router.delete("/default-images/{image_id}", status_code=204)
async def delete_default_image(
    image_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        image_uuid = uuid.UUID(image_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid image_id format")

    result = await db.execute(
        select(DefaultAnimalImage).where(DefaultAnimalImage.id == image_uuid)
    )
    image = result.scalar_one_or_none()

    if not image:
        raise HTTPException(status_code=404, detail="Default image not found")

    # Delete from storage (best effort)
    await supabase_storage_service.delete_file(
        storage_path=image.storage_path,
        bucket=supabase_storage_service.default_images_bucket,
    )

    # Delete from DB
    await db.delete(image)
    await db.commit()
