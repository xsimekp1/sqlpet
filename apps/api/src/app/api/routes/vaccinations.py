import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.dependencies.auth import (
    get_current_organization_id,
    require_permission,
)
from src.app.api.dependencies.db import get_db
from src.app.models.animal import Animal
from src.app.models.animal_vaccination import AnimalVaccination
from src.app.models.inventory_lot import InventoryLot
from src.app.models.user import User
from src.app.schemas.animal_vaccination import (
    VaccinationCreate,
    VaccinationListResponse,
    VaccinationResponse,
    VaccinationUpdate,
    VaccinationWithAnimalResponse,
)

router = APIRouter(prefix="/vaccinations", tags=["vaccinations"])


def _to_response(vaccination: AnimalVaccination) -> VaccinationResponse:
    return VaccinationResponse.model_validate(vaccination)


def _to_response_with_animal(
    vaccination: AnimalVaccination,
) -> VaccinationWithAnimalResponse:
    data = VaccinationWithAnimalResponse.model_validate(vaccination)
    if vaccination.animal:
        data.animal_name = vaccination.animal.name
        data.animal_public_code = vaccination.animal.public_code
    return data


@router.post(
    "", response_model=VaccinationResponse, status_code=status.HTTP_201_CREATED
)
async def create_vaccination(
    data: VaccinationCreate,
    current_user: User = Depends(require_permission("medical.write")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    if data.lot_id:
        lot_result = await db.execute(
            select(InventoryLot).where(
                InventoryLot.id == data.lot_id,
                InventoryLot.organization_id == organization_id,
            )
        )
        lot = lot_result.scalar_one_or_none()
        if lot:
            lot_number = lot.lot_number
        else:
            lot_number = None
    else:
        lot_number = None

    vaccination = AnimalVaccination(
        id=uuid.uuid4(),
        organization_id=organization_id,
        lot_number=lot_number,
        **data.model_dump(),
    )
    db.add(vaccination)
    await db.commit()
    await db.refresh(vaccination)
    return _to_response(vaccination)


@router.get("", response_model=VaccinationListResponse)
async def list_vaccinations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    animal_id: Optional[uuid.UUID] = Query(None),
    vaccination_type: Optional[str] = Query(None),
    lot_id: Optional[uuid.UUID] = Query(None),
    lot_number: Optional[str] = Query(None),
    current_user: User = Depends(require_permission("medical.read")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    q = select(AnimalVaccination).where(
        AnimalVaccination.organization_id == organization_id
    )

    if animal_id:
        q = q.where(AnimalVaccination.animal_id == animal_id)
    if vaccination_type:
        q = q.where(AnimalVaccination.vaccination_type == vaccination_type)
    if lot_id:
        q = q.where(AnimalVaccination.lot_id == lot_id)
    if lot_number:
        q = q.where(AnimalVaccination.lot_number.ilike(f"%{lot_number}%"))

    count_q = select(func.count()).select_from(q.subquery())
    total_result = await db.execute(count_q)
    total = total_result.scalar()

    q = (
        q.order_by(AnimalVaccination.administered_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(q)
    vaccinations = result.scalars().all()

    items = [_to_response_with_animal(v) for v in vaccinations]

    return VaccinationListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/animal/{animal_id}", response_model=VaccinationListResponse)
async def get_animal_vaccinations(
    animal_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_permission("medical.read")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    animal_result = await db.execute(
        select(Animal).where(
            Animal.id == animal_id,
            Animal.organization_id == organization_id,
        )
    )
    animal = animal_result.scalar_one_or_none()
    if not animal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found"
        )

    q = select(AnimalVaccination).where(
        AnimalVaccination.animal_id == animal_id,
        AnimalVaccination.organization_id == organization_id,
    )

    count_q = select(func.count()).select_from(q.subquery())
    total_result = await db.execute(count_q)
    total = total_result.scalar()

    q = (
        q.order_by(AnimalVaccination.administered_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(q)
    vaccinations = result.scalars().all()

    items = [_to_response_with_animal(v) for v in vaccinations]

    return VaccinationListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/lots/available", response_model=list[dict])
async def get_available_lots(
    vaccination_type: Optional[str] = Query(None),
    current_user: User = Depends(require_permission("medical.read")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    q = select(InventoryLot).where(
        InventoryLot.organization_id == organization_id,
        InventoryLot.quantity > 0,
    )

    if vaccination_type:
        q = q.where(
            InventoryLot.item_id.in_(
                select(InventoryLot.item_id).where(
                    InventoryLot.item_id == InventoryLot.item_id
                )
            )
        )

    q = q.order_by(InventoryLot.expires_at.asc().nulls_last())
    result = await db.execute(q)
    lots = result.scalars().all()

    return [
        {
            "id": lot.id,
            "lot_number": lot.lot_number,
            "quantity": lot.quantity,
            "expires_at": lot.expires_at.isoformat() if lot.expires_at else None,
        }
        for lot in lots
    ]


@router.get("/{vaccination_id}", response_model=VaccinationWithAnimalResponse)
async def get_vaccination(
    vaccination_id: uuid.UUID,
    current_user: User = Depends(require_permission("medical.read")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AnimalVaccination).where(
            AnimalVaccination.id == vaccination_id,
            AnimalVaccination.organization_id == organization_id,
        )
    )
    vaccination = result.scalar_one_or_none()
    if not vaccination:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Vaccination not found"
        )
    return _to_response_with_animal(vaccination)


@router.patch("/{vaccination_id}", response_model=VaccinationResponse)
async def update_vaccination(
    vaccination_id: uuid.UUID,
    data: VaccinationUpdate,
    current_user: User = Depends(require_permission("medical.write")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AnimalVaccination).where(
            AnimalVaccination.id == vaccination_id,
            AnimalVaccination.organization_id == organization_id,
        )
    )
    vaccination = result.scalar_one_or_none()
    if not vaccination:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Vaccination not found"
        )

    if data.lot_id and data.lot_id != vaccination.lot_id:
        lot_result = await db.execute(
            select(InventoryLot).where(
                InventoryLot.id == data.lot_id,
                InventoryLot.organization_id == organization_id,
            )
        )
        lot = lot_result.scalar_one_or_none()
        if lot:
            vaccination.lot_number = lot.lot_number

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(vaccination, field, value)

    await db.commit()
    await db.refresh(vaccination)
    return _to_response(vaccination)


@router.delete("/{vaccination_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vaccination(
    vaccination_id: uuid.UUID,
    current_user: User = Depends(require_permission("medical.write")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AnimalVaccination).where(
            AnimalVaccination.id == vaccination_id,
            AnimalVaccination.organization_id == organization_id,
        )
    )
    vaccination = result.scalar_one_or_none()
    if not vaccination:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Vaccination not found"
        )

    await db.delete(vaccination)
    await db.commit()
