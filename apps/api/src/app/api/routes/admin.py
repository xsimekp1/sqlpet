import uuid
from io import BytesIO
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.dependencies.auth import get_current_user, get_current_organization_id
from src.app.api.dependencies.db import get_db
from src.app.models.breed import Breed
from src.app.models.breed_i18n import BreedI18n
from src.app.models.file import DefaultAnimalImage
from src.app.models.user import User
from src.app.models.membership import Membership, MembershipStatus
from src.app.models.role import Role
from src.app.core.security import hash_password
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


COLOR_CATALOG = [
    "black",
    "white",
    "brown",
    "golden",
    "grey",
    "gray",
    "tan",
    "fawn",
    "blue",
    "red",
    "cream",
    "brindle",
    "orange",
    "black-white",
    "black_white",
    "black-tan-white",
    "black_tan_white",
    "blue-tan",
    "blue_tan",
]


class ColorAdminResponse(BaseModel):
    code: str
    cs: Optional[str] = None
    en: Optional[str] = None


class UpdateColorTranslationsRequest(BaseModel):
    cs: Optional[str] = None
    en: Optional[str] = None


@router.get("/colors", response_model=List[ColorAdminResponse])
async def list_colors_admin(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        text("SELECT code, locale, name FROM color_i18n WHERE organization_id IS NULL")
    )
    rows = result.fetchall()

    # Build a lookup: code -> {locale: name}
    lookup: dict = {}
    for code, locale, name in rows:
        if code not in lookup:
            lookup[code] = {}
        lookup[code][locale] = name

    return [
        ColorAdminResponse(
            code=code,
            cs=lookup.get(code, {}).get("cs"),
            en=lookup.get(code, {}).get("en"),
        )
        for code in COLOR_CATALOG
    ]


@router.put("/colors/{code}/translations", status_code=200)
async def update_color_translations(
    code: str,
    body: UpdateColorTranslationsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if code not in COLOR_CATALOG:
        raise HTTPException(status_code=404, detail="Color code not found")

    for locale, name in [("cs", body.cs), ("en", body.en)]:
        if name is None:
            continue
        name = name.strip()
        existing = await db.execute(
            text(
                "SELECT id FROM color_i18n WHERE code = :code AND locale = :locale "
                "AND organization_id IS NULL"
            ),
            {"code": code, "locale": locale},
        )
        row = existing.fetchone()
        if row:
            await db.execute(
                text(
                    "UPDATE color_i18n SET name = :name WHERE code = :code "
                    "AND locale = :locale AND organization_id IS NULL"
                ),
                {"name": name, "code": code, "locale": locale},
            )
        else:
            await db.execute(
                text(
                    "INSERT INTO color_i18n (code, locale, name) "
                    "VALUES (:code, :locale, :name)"
                ),
                {"code": code, "locale": locale, "name": name},
            )

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


# ── Member management ─────────────────────────────────────────────────────────

class MemberCreateRequest(BaseModel):
    name: str
    email: str
    password: str
    role_id: Optional[str] = None


class MemberCreateResponse(BaseModel):
    user_id: str
    email: str
    name: str


class SetPasswordRequest(BaseModel):
    new_password: str


class MemberListItem(BaseModel):
    user_id: str
    email: str
    name: str
    role_id: Optional[str] = None
    role_name: Optional[str] = None
    status: str


@router.get("/members", response_model=List[MemberListItem])
async def list_members(
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """List all members of the current organization."""
    result = await db.execute(
        select(Membership, User, Role)
        .join(User, User.id == Membership.user_id)
        .outerjoin(Role, Role.id == Membership.role_id)
        .where(Membership.organization_id == organization_id)
        .order_by(User.name)
    )
    rows = result.all()
    return [
        MemberListItem(
            user_id=str(row.User.id),
            email=row.User.email,
            name=row.User.name,
            role_id=str(row.Membership.role_id) if row.Membership.role_id else None,
            role_name=row.Role.name if row.Role else None,
            status=row.Membership.status.value,
        )
        for row in rows
    ]


@router.post("/members/create", response_model=MemberCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_member(
    data: MemberCreateRequest,
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a new user and add them to the current organization."""
    # Check if email already exists
    existing = await db.execute(select(User).where(User.email == data.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Create user
    new_user = User(
        id=uuid.uuid4(),
        email=data.email,
        password_hash=hash_password(data.password),
        name=data.name,
        is_superadmin=False,
    )
    db.add(new_user)
    await db.flush()

    # Parse role_id if provided and validate it belongs to this org
    role_id = None
    if data.role_id:
        try:
            role_uuid = uuid.UUID(data.role_id)
            role_result = await db.execute(
                select(Role).where(Role.id == role_uuid, Role.organization_id == organization_id)
            )
            role = role_result.scalar_one_or_none()
            if role:
                role_id = role_uuid
        except ValueError:
            pass

    # Create membership
    membership = Membership(
        id=uuid.uuid4(),
        user_id=new_user.id,
        organization_id=organization_id,
        role_id=role_id,
        status=MembershipStatus.ACTIVE,
    )
    db.add(membership)
    await db.commit()

    return MemberCreateResponse(
        user_id=str(new_user.id),
        email=new_user.email,
        name=new_user.name,
    )


@router.post("/members/{user_id}/set-password", status_code=status.HTTP_204_NO_CONTENT)
async def set_member_password(
    user_id: str,
    data: SetPasswordRequest,
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Reset a member's password. Requires the target user to be in the same organization."""
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID")

    # Verify target user is a member of this org
    membership_result = await db.execute(
        select(Membership).where(
            Membership.user_id == user_uuid,
            Membership.organization_id == organization_id,
        )
    )
    if membership_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found in this organization")

    # Update password
    user_result = await db.execute(select(User).where(User.id == user_uuid))
    target_user = user_result.scalar_one_or_none()
    if target_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    target_user.password_hash = hash_password(data.new_password)
    await db.commit()
