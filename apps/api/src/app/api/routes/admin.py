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
from src.app.models.breed_i18n import BreedI18n
from src.app.models.file import DefaultAnimalImage
from src.app.models.user import User
from src.app.services.supabase_storage_service import supabase_storage_service

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"}

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
    breed_name: Optional[str] = Form(None),
    color_pattern: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Validate content type via header (admin-only endpoint, no python-magic needed)
    content_type = (file.content_type or "").lower().split(";")[0].strip()
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"File type '{content_type}' not allowed. Use JPEG, PNG or WEBP.",
        )
    file_content = await file.read()

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

    # Resolve breed — either by ID or by creating a new one from breed_name
    breed_uuid = None
    resolved_breed_name = None
    breed_slug = None

    if breed_id and breed_id != "none":
        try:
            breed_uuid = uuid.UUID(breed_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid breed_id format")
        breed_result = await db.execute(select(Breed).where(Breed.id == breed_uuid))
        breed_obj = breed_result.scalar_one_or_none()
        if not breed_obj:
            raise HTTPException(status_code=404, detail="Breed not found")
        resolved_breed_name = breed_obj.name
        breed_slug = breed_obj.name.lower().replace(" ", "_")
    elif breed_name and breed_name.strip():
        clean_name = breed_name.strip()
        # Find existing or create new breed
        breed_result = await db.execute(
            select(Breed).where(Breed.species == species, Breed.name == clean_name)
        )
        breed_obj = breed_result.scalar_one_or_none()
        if not breed_obj:
            breed_obj = Breed(species=species, name=clean_name)
            db.add(breed_obj)
            await db.flush()
        breed_uuid = breed_obj.id
        resolved_breed_name = breed_obj.name
        breed_slug = clean_name.lower().replace(" ", "_")

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
        file_content=file_content,
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
        breed_name=resolved_breed_name,
        color_pattern=default_image.color_pattern,
        public_url=default_image.public_url,
        storage_path=default_image.storage_path,
        filename_pattern=default_image.filename_pattern,
        is_active=default_image.is_active,
        priority=default_image.priority,
        source=default_image.source,
        created_at=default_image.created_at.isoformat(),
    )


class BreedTranslationItem(BaseModel):
    locale: str
    name: str


class BreedAdminResponse(BaseModel):
    id: str
    species: str
    name: str
    translations: List[BreedTranslationItem]


class UpdateBreedTranslationsRequest(BaseModel):
    cs: Optional[str] = None
    en: Optional[str] = None


@router.get("/breeds", response_model=List[BreedAdminResponse])
async def list_breeds_admin(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Breed).order_by(Breed.species, Breed.name))
    breeds = result.scalars().all()

    response = []
    for breed in breeds:
        i18n_result = await db.execute(
            select(BreedI18n).where(BreedI18n.breed_id == breed.id)
        )
        translations = i18n_result.scalars().all()
        response.append(
            BreedAdminResponse(
                id=str(breed.id),
                species=breed.species,
                name=breed.name,
                translations=[
                    BreedTranslationItem(locale=t.locale, name=t.name)
                    for t in translations
                ],
            )
        )
    return response


@router.put("/breeds/{breed_id}/translations", status_code=200)
async def update_breed_translations(
    breed_id: str,
    body: UpdateBreedTranslationsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        breed_uuid = uuid.UUID(breed_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid breed_id format")

    result = await db.execute(select(Breed).where(Breed.id == breed_uuid))
    breed = result.scalar_one_or_none()
    if not breed:
        raise HTTPException(status_code=404, detail="Breed not found")

    for locale, name in [("cs", body.cs), ("en", body.en)]:
        if name is None:
            continue
        name = name.strip()
        i18n_result = await db.execute(
            select(BreedI18n).where(
                BreedI18n.breed_id == breed_uuid,
                BreedI18n.locale == locale,
            )
        )
        existing = i18n_result.scalar_one_or_none()
        if existing:
            existing.name = name
        else:
            db.add(BreedI18n(breed_id=breed_uuid, locale=locale, name=name))

    await db.commit()
    return {"ok": True}


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
