import uuid
from io import BytesIO
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.dependencies.auth import (
    get_current_user,
    get_current_organization_id,
    require_permission,
    oauth2_scheme,
)
from src.app.api.dependencies.db import get_db
from src.app.models.breed import Breed
from src.app.models.breed_i18n import BreedI18n
from src.app.models.file import DefaultAnimalImage
from src.app.models.user import User
from src.app.models.membership import Membership, MembershipStatus
from src.app.models.role import Role
from src.app.models.role_permission import RolePermission
from src.app.models.organization import Organization
from src.app.core.security import hash_password, decode_token
from src.app.api.dependencies.auth import oauth2_scheme, decode_token
from src.app.services.supabase_storage_service import supabase_storage_service

ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
}

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
    "tabby",
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
    used_count: int = 0


class UpdateColorTranslationsRequest(BaseModel):
    cs: Optional[str] = None
    en: Optional[str] = None


class CreateColorRequest(BaseModel):
    code: str
    cs: Optional[str] = None
    en: Optional[str] = None


class DeleteColorRequest(BaseModel):
    pass


@router.get("/colors", response_model=List[ColorAdminResponse])
async def list_colors_admin(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Get all translated colors
    i18n_result = await db.execute(
        text("SELECT code, locale, name FROM color_i18n WHERE organization_id IS NULL")
    )
    i18n_rows = i18n_result.fetchall()

    # Build a lookup: code -> {locale: name}
    lookup: dict = {}
    for code, locale, name in i18n_rows:
        if code not in lookup:
            lookup[code] = {}
        lookup[code][locale] = name

    # Also collect all distinct color codes used in animals
    animal_colors_result = await db.execute(
        text(
            "SELECT color, COUNT(*) as cnt FROM animals WHERE color IS NOT NULL AND color != '' GROUP BY color"
        )
    )
    animal_color_counts = {row[0]: row[1] for row in animal_colors_result.fetchall()}

    # Also get colors from default_animal_images
    image_colors_result = await db.execute(
        text(
            "SELECT DISTINCT color_pattern FROM default_animal_images WHERE color_pattern IS NOT NULL AND color_pattern != ''"
        )
    )
    image_colors = {row[0] for row in image_colors_result.fetchall()}

    # Build full list: i18n keys + any animal colors + image colors, sorted
    all_codes = sorted(
        set(list(lookup.keys()) + list(animal_color_counts.keys()) + list(image_colors))
    )

    return [
        ColorAdminResponse(
            code=code,
            cs=lookup.get(code, {}).get("cs"),
            en=lookup.get(code, {}).get("en"),
            used_count=animal_color_counts.get(code, 0),
        )
        for code in all_codes
    ]


@router.put("/colors/{code}/translations", status_code=200)
async def update_color_translations(
    code: str,
    body: UpdateColorTranslationsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Accept any valid color code (not restricted to COLOR_CATALOG)

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


@router.post("/colors", status_code=201)
async def create_color(
    body: CreateColorRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    code = body.code.strip().lower()
    if not code:
        raise HTTPException(status_code=400, detail="Color code is required")

    # Check if color already exists
    existing = await db.execute(
        text(
            "SELECT code FROM color_i18n WHERE code = :code AND organization_id IS NULL LIMIT 1"
        ),
        {"code": code},
    )
    if existing.fetchone():
        raise HTTPException(status_code=409, detail="Color already exists")

    # Insert translations if provided
    for locale, name in [("cs", body.cs), ("en", body.en)]:
        if name:
            await db.execute(
                text(
                    "INSERT INTO color_i18n (code, locale, name) VALUES (:code, :locale, :name)"
                ),
                {"code": code, "locale": locale, "name": name.strip()},
            )

    await db.commit()
    return {"ok": True, "code": code}


@router.delete("/colors/{code}", status_code=204)
async def delete_color(
    code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check if color is used by any animals
    usage_check = await db.execute(
        text("SELECT COUNT(*) FROM animals WHERE color = :code AND deleted_at IS NULL"),
        {"code": code},
    )
    count = usage_check.scalar()
    if count and count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Color is used by {count} animals and cannot be deleted",
        )

    # Delete translations
    await db.execute(
        text("DELETE FROM color_i18n WHERE code = :code AND organization_id IS NULL"),
        {"code": code},
    )

    await db.commit()
    return None


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


@router.post(
    "/members/create",
    response_model=MemberCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_member(
    data: MemberCreateRequest,
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a new user and add them to the current organization."""
    # Check if user with this email already exists
    existing_user = (
        await db.execute(select(User).where(User.email == data.email))
    ).scalar_one_or_none()

    if existing_user:
        # Check if already a member of this org
        existing_membership = (
            await db.execute(
                select(Membership).where(
                    Membership.user_id == existing_user.id,
                    Membership.organization_id == organization_id,
                )
            )
        ).scalar_one_or_none()
        if existing_membership:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is already a member of this organization",
            )
        # Add existing user to org — skip creating a new User
        target_user = existing_user
    else:
        # Create new user
        target_user = User(
            id=uuid.uuid4(),
            email=data.email,
            password_hash=hash_password(data.password),
            name=data.name,
            is_superadmin=False,
        )
        db.add(target_user)
        await db.flush()

    # Parse role_id if provided and validate it belongs to this org
    role_id = None
    if data.role_id:
        try:
            role_uuid = uuid.UUID(data.role_id)
            role_result = await db.execute(
                select(Role).where(
                    Role.id == role_uuid, Role.organization_id == organization_id
                )
            )
            role = role_result.scalar_one_or_none()
            if role:
                role_id = role_uuid
        except ValueError:
            pass

    # Create membership for target_user (existing or new)
    membership = Membership(
        id=uuid.uuid4(),
        user_id=target_user.id,
        organization_id=organization_id,
        role_id=role_id,
        status=MembershipStatus.ACTIVE,
    )
    db.add(membership)
    await db.commit()

    return MemberCreateResponse(
        user_id=str(target_user.id),
        email=target_user.email,
        name=target_user.name,
    )


class RoleListItem(BaseModel):
    id: str
    name: str


@router.get("/roles", response_model=List[RoleListItem])
async def list_org_roles(
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """List roles available in the current organization."""
    result = await db.execute(
        select(Role).where(Role.organization_id == organization_id).order_by(Role.name)
    )
    return [RoleListItem(id=str(r.id), name=r.name) for r in result.scalars().all()]


class SetRoleRequest(BaseModel):
    role_id: Optional[str] = None  # None to remove role


@router.patch("/members/{user_id}/role", status_code=status.HTTP_204_NO_CONTENT)
async def set_member_role(
    user_id: str,
    body: SetRoleRequest,
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Change the role of a member in the current organization."""
    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID"
        )

    membership_result = await db.execute(
        select(Membership).where(
            Membership.user_id == user_uuid,
            Membership.organization_id == organization_id,
        )
    )
    membership = membership_result.scalar_one_or_none()
    if membership is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in this organization",
        )

    if body.role_id:
        try:
            role_uuid = uuid.UUID(body.role_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role ID"
            )
        role_result = await db.execute(
            select(Role).where(
                Role.id == role_uuid, Role.organization_id == organization_id
            )
        )
        if role_result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Role not found in this organization",
            )
        membership.role_id = role_uuid
    else:
        membership.role_id = None

    await db.commit()


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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID"
        )

    # Verify target user is a member of this org
    membership_result = await db.execute(
        select(Membership).where(
            Membership.user_id == user_uuid,
            Membership.organization_id == organization_id,
        )
    )
    if membership_result.scalar_one_or_none() is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in this organization",
        )

    # Update password
    user_result = await db.execute(select(User).where(User.id == user_uuid))
    target_user = user_result.scalar_one_or_none()
    if target_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    target_user.password_hash = hash_password(data.new_password)
    await db.commit()


@router.post("/roles/init-from-templates", status_code=status.HTTP_204_NO_CONTENT)
async def init_org_roles_from_templates(
    current_user: User = Depends(require_permission("users.manage")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Create org-specific copies of all global template roles (idempotent)."""
    from src.app.services.role_service import init_org_roles as _init_org_roles

    await _init_org_roles(db, organization_id)
    await db.commit()


# ========================================
# ROLE MANAGEMENT
# ========================================


class CreateRoleRequest(BaseModel):
    name: str
    description: Optional[str] = ""


class RoleDetailResponse(BaseModel):
    id: str
    name: str
    description: str
    is_template: bool
    permissions: List[str] = []


class PermissionItem(BaseModel):
    key: str
    allowed: bool


class UpdatePermissionsRequest(BaseModel):
    permissions: List[PermissionItem]


@router.post(
    "/roles", response_model=RoleDetailResponse, status_code=status.HTTP_201_CREATED
)
async def create_role(
    body: CreateRoleRequest,
    current_user: User = Depends(require_permission("users.manage")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a new role in the current organization."""
    result = await db.execute(
        select(Role).where(
            Role.organization_id == organization_id,
            Role.name == body.name,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role with this name already exists in the organization",
        )

    new_role = Role(
        id=uuid.uuid4(),
        organization_id=organization_id,
        name=body.name,
        description=body.description or "",
        is_template=False,
    )
    db.add(new_role)
    await db.commit()
    await db.refresh(new_role)

    return RoleDetailResponse(
        id=str(new_role.id),
        name=new_role.name,
        description=new_role.description,
        is_template=new_role.is_template,
        permissions=[],
    )


@router.get("/roles/{role_id}", response_model=RoleDetailResponse)
async def get_role_details(
    role_id: str,
    current_user: User = Depends(require_permission("users.manage")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Get details of a role including its permissions."""
    try:
        role_uuid = uuid.UUID(role_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid role ID")

    result = await db.execute(
        select(Role).where(
            Role.id == role_uuid, Role.organization_id == organization_id
        )
    )
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    # Get permissions for this role
    perm_result = await db.execute(
        select(RolePermission).where(RolePermission.role_id == role_uuid)
    )
    role_perms = perm_result.scalars().all()
    permissions = [str(p.permission_id) for p in role_perms if p.allowed]

    return RoleDetailResponse(
        id=str(role.id),
        name=role.name,
        description=role.description,
        is_template=role.is_template,
        permissions=permissions,
    )


@router.get("/roles/{role_id}/permissions")
async def get_role_permissions(
    role_id: str,
    current_user: User = Depends(require_permission("users.manage")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Get all permissions (allowed/not allowed) for a role."""
    try:
        role_uuid = uuid.UUID(role_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid role ID")

    from src.app.models.permission import Permission
    from src.app.models.role_permission import RolePermission

    result = await db.execute(
        select(Role).where(
            Role.id == role_uuid, Role.organization_id == organization_id
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Role not found")

    result = await db.execute(
        select(Permission.key, RolePermission.allowed)
        .outerjoin(
            RolePermission,
            (RolePermission.permission_id == Permission.id)
            & (RolePermission.role_id == role_uuid),
        )
        .order_by(Permission.key)
    )
    rows = result.all()

    return [{"key": key, "allowed": bool(allowed)} for key, allowed in rows]


@router.put("/roles/{role_id}/permissions", status_code=status.HTTP_204_NO_CONTENT)
async def update_role_permissions(
    role_id: str,
    body: UpdatePermissionsRequest,
    current_user: User = Depends(require_permission("users.manage")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Update permissions for a role."""
    try:
        role_uuid = uuid.UUID(role_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid role ID")

    # Verify role exists and belongs to org
    result = await db.execute(
        select(Role).where(
            Role.id == role_uuid, Role.organization_id == organization_id
        )
    )
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    if role.is_template:
        raise HTTPException(status_code=400, detail="Cannot modify template roles")

    # Get all permission keys
    from src.app.models.permission import Permission

    perm_result = await db.execute(select(Permission))
    all_perms = {p.key: p.id for p in perm_result.scalars().all()}

    # Delete existing role permissions
    await db.execute(
        RolePermission.__table__.delete().where(RolePermission.role_id == role_uuid)
    )

    # Add new permissions
    for perm in body.permissions:
        if perm.key in all_perms:
            db.add(
                RolePermission(
                    role_id=role_uuid,
                    permission_id=all_perms[perm.key],
                    allowed=perm.allowed,
                )
            )

    await db.commit()


# ─── Organizations (Superadmin) ───────────────────────────────────────────────


class OrganizationAdminResponse(BaseModel):
    id: str
    name: str
    region: str | None
    country: str | None
    phone: str | None
    admin_note: str | None
    member_count: int
    created_at: str | None
    admins: List[dict]  # [{"id": str, "name": str, "email": str}]


@router.get("/organizations", response_model=List[OrganizationAdminResponse])
async def get_all_organizations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    token: str | None = Depends(oauth2_scheme),
):
    """Get all organizations with their admin members. Only accessible by superadmin."""
    # Check superadmin
    is_superadmin = current_user.is_superadmin
    if not is_superadmin and current_user.email == "admin@example.com":
        is_superadmin = True
    if not is_superadmin and token:
        try:
            payload = decode_token(token)
            is_superadmin = payload.get("superadmin", False)
        except Exception:
            pass

    if not is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superadmin can access this resource",
        )

    # Get all organizations with member count
    orgs_query = text("""
        SELECT 
            o.id, 
            o.name, 
            o.region,
            o.country,
            o.phone,
            o.admin_note,
            o.created_at,
            COUNT(m.id) as member_count
        FROM organizations o
        LEFT JOIN memberships m ON m.organization_id = o.id
        GROUP BY o.id, o.name, o.region, o.country, o.phone, o.admin_note, o.created_at
        ORDER BY o.created_at DESC
    """)
    orgs_result = await db.execute(orgs_query)
    orgs = orgs_result.fetchall()

    # Get all admin memberships
    admins_query = text("""
        SELECT 
            m.organization_id,
            u.id as user_id,
            u.name,
            u.email
        FROM memberships m
        JOIN users u ON u.id = m.user_id
        JOIN roles r ON r.id = m.role_id
        WHERE r.name = 'admin'
    """)
    admins_result = await db.execute(admins_query)
    admins_by_org: dict = {}
    for row in admins_result.fetchall():
        org_id = str(row.organization_id)
        if org_id not in admins_by_org:
            admins_by_org[org_id] = []
        admins_by_org[org_id].append(
            {"id": str(row.user_id), "name": row.name, "email": row.email}
        )

    return [
        OrganizationAdminResponse(
            id=str(org.id),
            name=org.name,
            region=org.region,
            country=org.country,
            phone=org.phone,
            admin_note=org.admin_note,
            member_count=org.member_count,
            created_at=org.created_at.isoformat() if org.created_at else None,
            admins=admins_by_org.get(str(org.id), []),
        )
        for org in orgs
    ]


class OrganizationAdminUpdate(BaseModel):
    phone: str | None = None
    admin_note: str | None = None


@router.patch("/organizations/{org_id}")
async def update_organization(
    org_id: uuid.UUID,
    data: OrganizationAdminUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    token: str | None = Depends(oauth2_scheme),
):
    """Update organization phone or admin_note. Only accessible by superadmin."""
    # Check superadmin
    is_superadmin = current_user.is_superadmin
    if not is_superadmin and current_user.email == "admin@example.com":
        is_superadmin = True
    if not is_superadmin and token:
        try:
            payload = decode_token(token)
            is_superadmin = payload.get("superadmin", False)
        except Exception:
            pass

    if not is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superadmin can access this resource",
        )

    # Get organization
    org = await db.get(Organization, org_id)
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found",
        )

    # Update fields
    if data.phone is not None:
        org.phone = data.phone
    if data.admin_note is not None:
        org.admin_note = data.admin_note

    await db.commit()
    await db.refresh(org)

    return {
        "id": str(org.id),
        "name": org.name,
        "phone": org.phone,
        "admin_note": org.admin_note,
    }


@router.delete("/organizations/{org_id}")
async def delete_organization(
    org_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    token: str | None = Depends(oauth2_scheme),
):
    """Delete an organization. Only accessible by superadmin."""
    # Check superadmin
    is_superadmin = current_user.is_superadmin
    if not is_superadmin and current_user.email == "admin@example.com":
        is_superadmin = True
    if not is_superadmin and token:
        try:
            payload = decode_token(token)
            is_superadmin = payload.get("superadmin", False)
        except Exception:
            pass

    if not is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superadmin can access this resource",
        )

    # Check organization exists
    from src.app.models.organization import Organization

    result = await db.execute(select(Organization).where(Organization.id == org_id))
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Delete organization (cascades to memberships, animals, etc.)
    await db.delete(org)
    await db.commit()

    return {"message": f"Organization '{org.name}' deleted successfully"}


class OrgMemberResponse(BaseModel):
    user_id: str
    name: str
    email: str
    role: str
    joined_at: str


@router.get("/organizations/{org_id}/members", response_model=List[OrgMemberResponse])
async def get_organization_members(
    org_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    token: str | None = Depends(oauth2_scheme),
):
    """Get all members of an organization. Only accessible by superadmin."""
    # Check superadmin
    is_superadmin = current_user.is_superadmin
    if not is_superadmin and current_user.email == "admin@example.com":
        is_superadmin = True
    if not is_superadmin and token:
        try:
            payload = decode_token(token)
            is_superadmin = payload.get("superadmin", False)
        except Exception:
            pass

    if not is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superadmin can access this resource",
        )

    # Get all members with roles
    members_query = text("""
        SELECT 
            u.id as user_id,
            u.name,
            u.email,
            r.name as role,
            m.created_at as joined_at
        FROM memberships m
        JOIN users u ON u.id = m.user_id
        JOIN roles r ON r.id = m.role_id
        WHERE m.organization_id = :org_id
        ORDER BY m.created_at ASC
    """)
    result = await db.execute(members_query, {"org_id": str(org_id)})
    members = result.fetchall()

    return [
        OrgMemberResponse(
            user_id=str(m.user_id),
            name=m.name,
            email=m.email,
            role=m.role,
            joined_at=m.joined_at.isoformat() if m.joined_at else None,
        )
        for m in members
    ]


# ─── Registered Shelters ───────────────────────────────────────────────────


class RegisteredShelterResponse(BaseModel):
    id: str
    registration_number: str
    name: str
    address: str
    region: str
    activity_type: str | None
    capacity: str | None
    lat: float | None
    lng: float | None
    registration_date: str | None
    notes: str | None
    phone: str | None
    website: str | None


@router.get("/registered-shelters", response_model=list[RegisteredShelterResponse])
async def get_registered_shelters(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    token: str | None = Depends(oauth2_scheme),
    region: str | None = None,
):
    """Get all registered shelters. Only accessible by superadmin."""
    # Check superadmin from user, token, or hardcoded email (for backwards compatibility)
    is_superadmin = current_user.is_superadmin
    if not is_superadmin and current_user.email == "admin@example.com":
        is_superadmin = True
    if not is_superadmin and token:
        try:
            payload = decode_token(token)
            is_superadmin = payload.get("superadmin", False)
        except Exception:
            pass

    if not is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superadmin can access this resource",
        )

    query = text("""
        SELECT id, registration_number, name, address, region, activity_type,
               capacity, lat, lng, registration_date, notes, phone, website
        FROM registered_shelters
        ORDER BY region, name
    """)

    result = await db.execute(query)
    rows = result.fetchall()

    shelters = []
    for row in rows:
        shelter = {
            "id": str(row[0]),
            "registration_number": row[1],
            "name": row[2],
            "address": row[3],
            "region": row[4],
            "activity_type": row[5],
            "capacity": row[6],
            "lat": row[7],
            "lng": row[8],
            "registration_date": row[9].isoformat() if row[9] else None,
            "notes": row[10] if len(row) > 10 else None,
            "phone": row[11] if len(row) > 11 else None,
            "website": row[12] if len(row) > 12 else None,
        }

        # Filter by region if provided
        if region is None or shelter["region"] == region:
            shelters.append(shelter)

    return shelters


@router.get("/registered-shelters/regions")
async def get_shelter_regions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    token: str | None = Depends(oauth2_scheme),
):
    """Get list of unique regions. Only accessible by superadmin."""
    is_superadmin = current_user.is_superadmin
    if not is_superadmin and current_user.email == "admin@example.com":
        is_superadmin = True
    if not is_superadmin and token:
        try:
            payload = decode_token(token)
            is_superadmin = payload.get("superadmin", False)
        except Exception:
            pass

    if not is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superadmin can access this resource",
        )

    query = text("""
        SELECT DISTINCT region FROM registered_shelters ORDER BY region
    """)

    result = await db.execute(query)
    rows = result.fetchall()

    return [{"region": row[0]} for row in rows]


@router.post("/registered-shelters/import", status_code=status.HTTP_200_OK)
async def import_registered_shelters(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    token: str | None = Depends(oauth2_scheme),
):
    """Import registered shelters from uploaded CSV file. Only accessible by superadmin."""
    is_superadmin = current_user.is_superadmin
    if not is_superadmin and current_user.email == "admin@example.com":
        is_superadmin = True
    if not is_superadmin and token:
        try:
            payload = decode_token(token)
            is_superadmin = payload.get("superadmin", False)
        except Exception:
            pass

    if not is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superadmin can access this resource",
        )

    # Validate file type
    if not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Invalid file type",
                "message": "Only CSV files are allowed",
                "filename": file.filename,
            },
        )

    import csv
    from datetime import datetime
    from io import StringIO

    # Read uploaded file content
    try:
        content = await file.read()
        csv_content = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "Encoding error",
                "message": "CSV file must be UTF-8 encoded",
            },
        )

    def parse_single_dms(dms: str) -> float | None:
        """Parse single DMS coordinate like 49°8'42.980"N"""
        try:
            dms = dms.replace("°", " ").replace("'", " ").replace('"', " ").strip()
            direction = None
            if "N" in dms or "S" in dms:
                direction = -1 if "S" in dms else 1
                dms = dms.replace("N", "").replace("S", "").strip()
            elif "E" in dms or "W" in dms:
                direction = -1 if "W" in dms else 1
                dms = dms.replace("E", "").replace("W", "").strip()
            parts = dms.split()
            if len(parts) < 3:
                return None
            degrees = float(parts[0])
            minutes = float(parts[1]) if len(parts) > 1 else 0
            seconds = float(parts[2]) if len(parts) > 2 else 0
            decimal = degrees + (minutes / 60) + (seconds / 3600)
            if direction:
                decimal *= direction
            return decimal
        except (ValueError, IndexError) as e:
            print(f"Error parsing DMS '{dms}': {e}")
            return None

    def parse_dms_to_decimal(dms_str: str) -> tuple[float | None, float | None]:
        """Parse GPS from DMS format like: 49°8'42.980"N,15°0'6.507"E"""
        if not dms_str:
            return None, None
        try:
            parts = dms_str.split(",")
            if len(parts) != 2:
                return None, None
            lat_str = parts[0].strip()
            lng_str = parts[1].strip()
            lat = parse_single_dms(lat_str)
            lng = parse_single_dms(lng_str)
            return lat, lng
        except Exception as e:
            print(f"Error parsing GPS '{dms_str}': {e}")
            return None, None

    def parse_date(date_str: str):
        """Parse date from Czech format like 29.12.2017"""
        if not date_str:
            return None
        try:
            dt = datetime.strptime(date_str.strip(), "%d.%m.%Y")
            return dt.date()  # Return date object, not isoformat string
        except ValueError as e:
            print(f"Error parsing date '{date_str}': {e}")
            return None

    # Validate CSV structure first
    try:
        csv_file = StringIO(csv_content)
        reader = csv.DictReader(csv_file)
        headers = reader.fieldnames

        required_headers = ["registrační číslo", "název", "adresa", "kraj"]
        missing_headers = [h for h in required_headers if h not in (headers or [])]

        if missing_headers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "Invalid CSV format",
                    "missing_columns": missing_headers,
                    "found_columns": list(headers or []),
                },
            )
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "CSV encoding error",
                "help": "File must be UTF-8 encoded",
            },
        )

    # Import data
    count = 0
    errors = []
    skipped = 0

    try:
        csv_file = StringIO(csv_content)
        reader = csv.DictReader(csv_file)

        for row_num, row in enumerate(reader, start=2):  # Start at 2 (header is row 1)
            try:
                # Extract and clean fields
                reg_number = row.get("registrační číslo", "").strip().strip('"')
                name = row.get("název", "").strip().strip('"')
                address = row.get("adresa", "").strip().strip('"')
                region = row.get("kraj", "").strip().strip('"')
                activity_type = row.get("druh činnosti", "").strip().strip('"')
                capacity = row.get("kapacita", "").strip().strip('"')
                gps = row.get("GPS", "").strip().strip('"')
                reg_date = row.get("datum registrace", "").strip().strip('"')

                # Validate required fields
                if not reg_number or not name:
                    errors.append(
                        {
                            "row": row_num,
                            "error": "Missing required fields (registration_number or name)",
                        }
                    )
                    skipped += 1
                    continue

                # Parse GPS
                lat, lng = parse_dms_to_decimal(gps)

                # Parse date
                parsed_date = parse_date(reg_date)

                # Insert into database (upsert - update on conflict)
                await db.execute(
                    text("""
                            INSERT INTO registered_shelters
                            (id, registration_number, name, address, region, activity_type, capacity, lat, lng, registration_date, imported_at, created_at, updated_at)
                            VALUES
                            (gen_random_uuid(), :reg_number, :name, :address, :region, :activity_type, :capacity, :lat, :lng, :reg_date, NOW(), NOW(), NOW())
                            ON CONFLICT (registration_number) DO UPDATE SET
                                name = EXCLUDED.name,
                                address = EXCLUDED.address,
                                region = EXCLUDED.region,
                                activity_type = EXCLUDED.activity_type,
                                capacity = EXCLUDED.capacity,
                                lat = EXCLUDED.lat,
                                lng = EXCLUDED.lng,
                                registration_date = EXCLUDED.registration_date,
                                imported_at = NOW(),
                                updated_at = NOW()
                        """),
                    {
                        "reg_number": reg_number,
                        "name": name,
                        "address": address,
                        "region": region,
                        "activity_type": activity_type or None,
                        "capacity": capacity or None,
                        "lat": lat,
                        "lng": lng,
                        "reg_date": parsed_date,
                    },
                )
                count += 1

            except Exception as e:
                errors.append({"row": row_num, "error": str(e)})
                if len(errors) > 50:  # Limit error collection
                    errors.append(
                        {"error": "Too many errors, stopping error collection"}
                    )
                    break

        await db.commit()

        # Return detailed response
        return {
            "imported": count,
            "skipped": skipped,
            "errors": errors[:10] if errors else [],  # Return first 10 errors
            "total_errors": len(errors),
        }

    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "Import failed",
                "message": str(e),
                "imported_before_failure": count,
            },
        )


class CreateRegisteredShelterRequest(BaseModel):
    registration_number: str
    name: str
    address: str
    region: str
    activity_type: str | None = None
    capacity: str | None = None
    lat: float | None = None
    lng: float | None = None
    registration_date: str | None = None
    notes: str | None = None
    phone: str | None = None
    website: str | None = None


@router.post("/registered-shelters", response_model=RegisteredShelterResponse)
async def create_registered_shelter(
    data: CreateRegisteredShelterRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    token: str | None = Depends(oauth2_scheme),
):
    """Create a new registered shelter. Only accessible by superadmin."""
    is_superadmin = current_user.is_superadmin
    if not is_superadmin and current_user.email == "admin@example.com":
        is_superadmin = True
    if not is_superadmin and token:
        try:
            payload = decode_token(token)
            is_superadmin = payload.get("superadmin", False)
        except Exception:
            pass

    if not is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superadmin can access this resource",
        )

    shelter_id = uuid.uuid4()

    await db.execute(
        text("""
            INSERT INTO registered_shelters
            (id, registration_number, name, address, region, activity_type, capacity, lat, lng, registration_date, notes, phone, website, imported_at, created_at, updated_at)
            VALUES
            (:id, :reg_number, :name, :address, :region, :activity_type, :capacity, :lat, :lng, :reg_date, :notes, :phone, :website, NOW(), NOW(), NOW())
        """),
        {
            "id": str(shelter_id),
            "reg_number": data.registration_number,
            "name": data.name,
            "address": data.address,
            "region": data.region,
            "activity_type": data.activity_type,
            "capacity": data.capacity,
            "lat": data.lat,
            "lng": data.lng,
            "reg_date": data.registration_date,
            "notes": data.notes,
            "phone": data.phone,
            "website": data.website,
        },
    )
    await db.commit()

    return RegisteredShelterResponse(
        id=str(shelter_id),
        registration_number=data.registration_number,
        name=data.name,
        address=data.address,
        region=data.region,
        activity_type=data.activity_type,
        capacity=data.capacity,
        lat=data.lat,
        lng=data.lng,
        registration_date=data.registration_date,
        notes=data.notes,
        phone=data.phone,
        website=data.website,
    )


class UpdateRegisteredShelterRequest(BaseModel):
    notes: str | None = None
    phone: str | None = None
    website: str | None = None


@router.patch("/registered-shelters/{shelter_id}", status_code=status.HTTP_200_OK)
async def update_registered_shelter(
    shelter_id: str,
    data: UpdateRegisteredShelterRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    token: str | None = Depends(oauth2_scheme),
):
    """Update contact details and notes for a shelter. Only accessible by superadmin."""
    is_superadmin = current_user.is_superadmin
    if not is_superadmin and current_user.email == "admin@example.com":
        is_superadmin = True
    if not is_superadmin and token:
        try:
            payload = decode_token(token)
            is_superadmin = payload.get("superadmin", False)
        except Exception:
            pass

    if not is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superadmin can access this resource",
        )

    try:
        shelter_uuid = uuid.UUID(shelter_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid shelter ID",
        )

    await db.execute(
        text("""
            UPDATE registered_shelters
            SET notes = :notes, phone = :phone, website = :website, updated_at = NOW()
            WHERE id = :id
        """),
        {"notes": data.notes, "phone": data.phone, "website": data.website, "id": str(shelter_uuid)},
    )
    await db.commit()

    return {"success": True}


class ShelterMapPoint(BaseModel):
    id: str
    name: str
    lat: float
    lng: float


@router.get("/registered-shelters/map", response_model=list[ShelterMapPoint])
async def get_shelters_for_map(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all shelters with GPS coordinates for map display."""
    result = await db.execute(
        text("""
            SELECT id, name, lat, lng
            FROM registered_shelters
            WHERE lat IS NOT NULL AND lng IS NOT NULL
            ORDER BY name
        """)
    )
    rows = result.fetchall()

    return [
        ShelterMapPoint(id=str(row[0]), name=row[1], lat=row[2], lng=row[3])
        for row in rows
    ]


class NearbyShelter(BaseModel):
    id: str
    name: str
    address: str
    lat: float
    lng: float
    distance_km: float
    accepts_dogs: Optional[bool] = None
    accepts_cats: Optional[bool] = None


@router.get("/registered-shelters/nearby", response_model=list[NearbyShelter])
async def get_nearby_shelters(
    lat: float,
    lng: float,
    radius_km: float = 25,
    species: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get shelters within radius of a GPS point using Haversine formula. Public endpoint."""
    species_filter = ""
    if species == "dog":
        species_filter = "AND accepts_dogs = true"
    elif species == "cat":
        species_filter = "AND accepts_cats = true"

    result = await db.execute(
        text(f"""
            SELECT id, name, address, lat, lng, distance_km, accepts_dogs, accepts_cats
            FROM (
                SELECT id, name, address, lat, lng,
                       (6371 * acos(
                           LEAST(1.0, GREATEST(-1.0,
                               cos(radians(:lat)) * cos(radians(lat)) *
                               cos(radians(lng) - radians(:lng)) +
                               sin(radians(:lat)) * sin(radians(lat))
                           ))
                       )) AS distance_km,
                       accepts_dogs, accepts_cats
                FROM registered_shelters
                WHERE lat IS NOT NULL AND lng IS NOT NULL
                {species_filter}
            ) _dist
            WHERE distance_km <= :radius
            ORDER BY distance_km
        """),
        {"lat": lat, "lng": lng, "radius": radius_km},
    )
    rows = result.fetchall()

    return [
        NearbyShelter(
            id=str(row[0]),
            name=row[1],
            address=row[2],
            lat=row[3],
            lng=row[4],
            distance_km=round(row[5], 2),
            accepts_dogs=row[6],
            accepts_cats=row[7],
        )
        for row in rows
    ]


class Set2FARequest(BaseModel):
    enabled: bool


@router.patch("/users/{user_id}/2fa")
async def set_user_2fa(
    user_id: str,
    body: Set2FARequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Superadmin can enable or disable 2FA for any user."""
    if not current_user.is_superadmin:
        if current_user.email != "admin@example.com":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only superadmins can manage 2FA for other users",
            )

    try:
        user_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID",
        )

    result = await db.execute(select(User).where(User.id == user_uuid))
    target_user = result.scalar_one_or_none()

    if target_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if body.enabled:
        if not target_user.totp_enabled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User has not set up 2FA. They must do it themselves.",
            )
    else:
        target_user.totp_enabled = False
        target_user.totp_secret = None
        target_user.backup_codes = None

    await db.commit()

    return {
        "message": f"2FA {'enabled' if body.enabled else 'disabled'} for user",
        "user_id": str(target_user.id),
        "totp_enabled": target_user.totp_enabled,
    }
