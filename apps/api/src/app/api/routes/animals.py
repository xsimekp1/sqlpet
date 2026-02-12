import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.dependencies.auth import (
    get_current_user,
    get_current_organization_id,
    require_permission,
)
from src.app.api.dependencies.db import get_db
from src.app.models.animal import Species
from src.app.models.kennel import KennelStay, Kennel as KennelModel
from src.app.models.breed import Breed
from src.app.models.breed_i18n import BreedI18n
from src.app.models.file import DefaultAnimalImage
from src.app.models.user import User
from src.app.schemas.animal import (
    AnimalCreate,
    AnimalListResponse,
    AnimalResponse,
    AnimalUpdate,
    AnimalBreedResponse,
    AnimalIdentifierResponse,
    BreedColorImageResponse,
    BreedResponse,
)
from src.app.services.animal_service import AnimalService
from src.app.services.default_image_service import DefaultImageService


async def _build_animal_response(animal, db: AsyncSession) -> AnimalResponse:
    """Build AnimalResponse from ORM object with nested breeds and identifiers."""
    breeds = [
        AnimalBreedResponse(
            breed_id=ab.breed_id,
            breed_name=ab.breed.name,
            breed_species=ab.breed.species,
            percent=ab.percent,
        )
        for ab in (animal.animal_breeds or [])
    ]
    identifiers = [
        AnimalIdentifierResponse.model_validate(ident)
        for ident in (animal.identifiers or [])
    ]
    resp = AnimalResponse.model_validate(animal)
    resp.breeds = breeds
    resp.identifiers = identifiers
    breed_id = animal.animal_breeds[0].breed_id if animal.animal_breeds else None
    svc = DefaultImageService(db)
    default_img = await svc.get_default_image_for_animal(
        species=animal.species, breed_id=breed_id, color=animal.color,
    )
    resp.default_image_url = default_img.public_url if default_img else None
    stay_result = await db.execute(
        select(KennelStay, KennelModel.name, KennelModel.code)
        .join(KennelModel, KennelModel.id == KennelStay.kennel_id)
        .where(KennelStay.animal_id == animal.id, KennelStay.end_at.is_(None))
        .limit(1)
    )
    stay_row = stay_result.first()
    if stay_row:
        stay, kennel_name, kennel_code = stay_row
        resp.current_kennel_id = str(stay.kennel_id)
        resp.current_kennel_name = kennel_name
        resp.current_kennel_code = kennel_code
    return resp


router = APIRouter(prefix="/animals", tags=["animals"])


@router.post(
    "",
    response_model=AnimalResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_animal(
    data: AnimalCreate,
    request: Request,
    current_user: User = Depends(require_permission("animals.write")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    svc = AnimalService(db)
    animal = await svc.create_animal(
        organization_id=organization_id,
        data=data,
        actor_id=current_user.id,
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    await db.commit()
    # Re-fetch to ensure relationships are loaded after commit
    await db.refresh(animal)
    return await _build_animal_response(animal, db)


@router.get(
    "",
    response_model=AnimalListResponse,
)
async def list_animals(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    species: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    sex: str | None = Query(None),
    search: str | None = Query(None),
    current_user: User = Depends(
        get_current_user
    ),  # Remove permission check temporarily
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """List animals with pagination and filters."""

    try:
        svc = AnimalService(db)
        items, total = await svc.list_animals(
            organization_id=organization_id,
            page=page,
            page_size=page_size,
            species=species,
            status=status_filter,
            sex=sex,
            search=search,
        )
        built_items = []
        for a in items:
            built_items.append(await _build_animal_response(a, db))
        return AnimalListResponse(
            items=built_items,
            total=total,
            page=page,
            page_size=page_size,
        )
    except Exception as e:
        import traceback

        print(f"ERROR in animals endpoint: {e}")
        print(f"ERROR traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.get(
    "/{animal_id}",
    response_model=AnimalResponse,
)
async def get_animal(
    animal_id: uuid.UUID,
    current_user: User = Depends(require_permission("animals.read")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    svc = AnimalService(db)
    animal = await svc.get_animal(organization_id, animal_id)
    if animal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found"
        )
    return await _build_animal_response(animal, db)


@router.patch(
    "/{animal_id}",
    response_model=AnimalResponse,
)
async def update_animal(
    animal_id: uuid.UUID,
    data: AnimalUpdate,
    request: Request,
    current_user: User = Depends(require_permission("animals.write")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    svc = AnimalService(db)
    animal = await svc.update_animal(
        organization_id=organization_id,
        animal_id=animal_id,
        data=data,
        actor_id=current_user.id,
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    if animal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found"
        )
    await db.commit()
    await db.refresh(animal)
    return await _build_animal_response(animal, db)


@router.delete(
    "/{animal_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_animal(
    animal_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_permission("animals.write")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    svc = AnimalService(db)
    deleted = await svc.delete_animal(
        organization_id=organization_id,
        animal_id=animal_id,
        actor_id=current_user.id,
        ip=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found"
        )
    await db.commit()


# --- Breeds endpoint (authenticated, no org scoping) ---

breed_router = APIRouter(prefix="/breeds", tags=["breeds"])


@breed_router.get("", response_model=list[BreedResponse])
async def list_breeds(
    species: str | None = Query(None),
    locale: str = Query(default="cs"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Breed, BreedI18n.name.label("i18n_name"))
        .outerjoin(
            BreedI18n,
            (BreedI18n.breed_id == Breed.id) & (BreedI18n.locale == locale),
        )
        .order_by(Breed.species, Breed.name)
    )
    if species:
        q = q.where(Breed.species == species)
    result = await db.execute(q)
    rows = result.fetchall()
    responses = []
    for breed, i18n_name in rows:
        resp = BreedResponse(
            id=breed.id,
            species=breed.species,
            name=breed.name,
            display_name=i18n_name or breed.name,
        )
        responses.append(resp)
    return responses


@breed_router.get("/{breed_id}/color-images", response_model=list[BreedColorImageResponse])
async def get_breed_color_images(
    breed_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return available color options with image URLs for a given breed."""
    result = await db.execute(
        select(DefaultAnimalImage.color_pattern, DefaultAnimalImage.public_url)
        .where(
            DefaultAnimalImage.breed_id == breed_id,
            DefaultAnimalImage.color_pattern.is_not(None),
            DefaultAnimalImage.is_active == True,
        )
        .order_by(DefaultAnimalImage.color_pattern)
    )
    rows = result.fetchall()
    return [BreedColorImageResponse(color=row[0], image_url=row[1]) for row in rows]
