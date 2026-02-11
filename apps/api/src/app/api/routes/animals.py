import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.dependencies.auth import get_current_user, require_permission
from src.app.api.dependencies.database import get_db
from src.app.models.animal import Species
from src.app.models.breed import Breed
from src.app.models.user import User
from src.app.schemas.animal import (
    AnimalCreate,
    AnimalListResponse,
    AnimalResponse,
    AnimalUpdate,
    AnimalBreedResponse,
    AnimalIdentifierResponse,
    BreedResponse,
)
from src.app.services.animal_service import AnimalService


def _build_animal_response(animal) -> AnimalResponse:
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
    return resp


router = APIRouter(prefix="/animals", tags=["animals"])


@router.post(
    "",
    response_model=AnimalResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_animal(
    organization_id: uuid.UUID,
    data: AnimalCreate,
    request: Request,
    current_user: User = Depends(require_permission("animals.write")),
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
    return _build_animal_response(animal)


@router.get(
    "",
    response_model=AnimalListResponse,
)
async def list_animals(
    organization_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    species: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    sex: str | None = Query(None),
    search: str | None = Query(None),
    current_user: User = Depends(require_permission("animals.read")),
    db: AsyncSession = Depends(get_db),
):
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
    return AnimalListResponse(
        items=[_build_animal_response(a) for a in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/{animal_id}",
    response_model=AnimalResponse,
)
async def get_animal(
    organization_id: uuid.UUID,
    animal_id: uuid.UUID,
    current_user: User = Depends(require_permission("animals.read")),
    db: AsyncSession = Depends(get_db),
):
    svc = AnimalService(db)
    animal = await svc.get_animal(organization_id, animal_id)
    if animal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found")
    return _build_animal_response(animal)


@router.patch(
    "/{animal_id}",
    response_model=AnimalResponse,
)
async def update_animal(
    organization_id: uuid.UUID,
    animal_id: uuid.UUID,
    data: AnimalUpdate,
    request: Request,
    current_user: User = Depends(require_permission("animals.write")),
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found")
    await db.commit()
    await db.refresh(animal)
    return _build_animal_response(animal)


@router.delete(
    "/{animal_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_animal(
    organization_id: uuid.UUID,
    animal_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(require_permission("animals.write")),
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
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found")
    await db.commit()


# --- Breeds endpoint (authenticated, no org scoping) ---

breed_router = APIRouter(prefix="/breeds", tags=["breeds"])


@breed_router.get("", response_model=list[BreedResponse])
async def list_breeds(
    species: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(Breed).order_by(Breed.species, Breed.name)
    if species:
        q = q.where(Breed.species == species)
    result = await db.execute(q)
    return list(result.scalars().all())
