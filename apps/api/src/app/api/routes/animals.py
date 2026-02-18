import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.dependencies.auth import (
    get_current_user,
    get_current_organization_id,
    require_permission,
)
from src.app.api.dependencies.db import get_db
from src.app.models.animal import Animal, Species
from src.app.models.animal_event import AnimalEvent, AnimalEventType
from src.app.models.animal_identifier import AnimalIdentifier
from src.app.models.animal_weight_log import AnimalWeightLog
from src.app.models.animal_bcs_log import AnimalBCSLog
from src.app.models.breed import Breed
from src.app.models.breed_i18n import BreedI18n
from src.app.models.file import DefaultAnimalImage
from src.app.models.user import User
from src.app.schemas.animal import (
    AnimalCreate,
    AnimalIdentifierCreate,
    AnimalListResponse,
    AnimalResponse,
    AnimalUpdate,
    AnimalBreedResponse,
    AnimalIdentifierResponse,
    BreedColorImageResponse,
    BreedResponse,
)
from src.app.schemas.weight_log import WeightLogCreate, WeightLogResponse
from src.app.schemas.bcs_log import BCSLogCreate, BCSLogResponse
from src.app.services.animal_service import AnimalService


async def _build_animal_response(
    animal,
    db: AsyncSession,
    kennel_data: dict | None = None,
    intake_data: dict | None = None,
) -> AnimalResponse:
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

    # default_image_url is now stored in DB - use it directly
    # (no query needed)

    # Use pre-loaded kennel/intake data if provided (list endpoint)
    animal_id_str = str(animal.id)
    if kennel_data and animal_id_str in kennel_data:
        kd = kennel_data[animal_id_str]
        resp.current_kennel_id = kd["kennel_id"]
        resp.current_kennel_name = kd["kennel_name"]
        resp.current_kennel_code = kd["kennel_code"]
    elif kennel_data is None:
        # Fallback: single animal fetch - query if not provided
        try:
            stay_result = await db.execute(
                text("""
                    SELECT ks.kennel_id::text, k.name, k.code
                    FROM kennel_stays ks
                    JOIN kennels k ON k.id = ks.kennel_id
                    WHERE ks.animal_id = :animal_id AND ks.end_at IS NULL
                    LIMIT 1
                """),
                {"animal_id": animal_id_str},
            )
            stay_row = stay_result.first()
            if stay_row:
                resp.current_kennel_id = stay_row[0]
                resp.current_kennel_name = stay_row[1]
                resp.current_kennel_code = stay_row[2]
        except Exception:
            pass

    if intake_data and animal_id_str in intake_data:
        resp.current_intake_date = intake_data[animal_id_str]
    elif intake_data is None:
        # Fallback: single animal fetch - query if not provided
        try:
            intake_result = await db.execute(
                text("""
                    SELECT intake_date FROM intakes
                    WHERE animal_id = :animal_id AND deleted_at IS NULL
                    ORDER BY intake_date DESC
                    LIMIT 1
                """),
                {"animal_id": animal_id_str},
            )
            intake_row = intake_result.first()
            if intake_row:
                resp.current_intake_date = intake_row[0]
        except Exception:
            pass

    # Generate thumbnail URL from primary_photo_url
    if animal.primary_photo_url:
        resp.thumbnail_url = animal.primary_photo_url.replace(
            "/animal-photos/", "/animal-thumbnails/"
        )

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
    try:
        svc = AnimalService(db)
        animal = await svc.create_animal(
            organization_id=organization_id,
            data=data,
            actor_id=current_user.id,
            ip=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
        await db.commit()
        # Full ORM SELECT after commit — ensures selectin relationships load correctly
        result = await db.execute(
            select(Animal).where(
                Animal.id == animal.id,
                Animal.organization_id == organization_id,
                Animal.deleted_at.is_(None),
            )
        )
        animal = result.scalar_one()
        return await _build_animal_response(animal, db)
    except HTTPException:
        raise
    except Exception as e:
        import traceback

        print(f"ERROR in create_animal: {e}")
        print(f"ERROR traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500, detail=f"Failed to create animal: {str(e)}"
        )


@router.get(
    "",
    response_model=AnimalListResponse,
)
async def list_animals(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    species: str | None = Query(None),
    status_filter: str | None = Query(None, alias="status"),
    sex: str | None = Query(None),
    search: str | None = Query(None),
    available_for_intake: bool = Query(False),
    current_user: User = Depends(require_permission("animals.read")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """List animals with pagination and filters."""

    try:
        svc = AnimalService(db)
        items, count, has_more, extra_data = await svc.list_animals(
            organization_id=organization_id,
            page=page,
            page_size=page_size,
            species=species,
            status=status_filter,
            sex=sex,
            search=search,
            available_for_intake=available_for_intake,
        )
        kennel_data = extra_data.get("kennels", {})
        intake_data = extra_data.get("intakes", {})
        built_items = []
        for a in items:
            built_items.append(
                await _build_animal_response(a, db, kennel_data, intake_data)
            )
        return AnimalListResponse(
            items=built_items,
            total=count,
            page=page,
            page_size=page_size,
            has_more=has_more,
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


# --- Weight log endpoints ---


@router.post(
    "/{animal_id}/weight",
    response_model=WeightLogResponse,
    status_code=status.HTTP_201_CREATED,
)
async def log_weight(
    animal_id: uuid.UUID,
    data: WeightLogCreate,
    current_user: User = Depends(require_permission("animals.write")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Log a weight measurement for an animal."""
    svc = AnimalService(db)
    animal = await svc.get_animal(organization_id, animal_id)
    if animal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found"
        )

    measured_at = data.measured_at or datetime.now(timezone.utc)
    log = AnimalWeightLog(
        animal_id=animal_id,
        weight_kg=data.weight_kg,
        measured_at=measured_at,
        notes=data.notes,
        recorded_by_user_id=current_user.id,
    )
    db.add(log)
    # Update the animal's current weight
    animal.weight_current_kg = data.weight_kg
    # Recalculate MER based on new weight
    if animal.weight_current_kg and animal.weight_current_kg > 0:
        rer = 70 * (float(animal.weight_current_kg) ** 0.75)
        if animal.species.value == "cat":
            activity_factor = 1.2
        elif animal.altered_status.value in ("intact",):
            activity_factor = 1.8
        else:
            activity_factor = 1.4
        animal.mer_kcal_per_day = int(rer * activity_factor)
    await db.commit()
    await db.refresh(log)
    return WeightLogResponse.model_validate(log)


@router.get(
    "/{animal_id}/weight",
    response_model=list[WeightLogResponse],
)
async def get_weight_history(
    animal_id: uuid.UUID,
    current_user: User = Depends(require_permission("animals.read")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Get weight history for an animal, newest first."""
    svc = AnimalService(db)
    animal = await svc.get_animal(organization_id, animal_id)
    if animal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found"
        )

    result = await db.execute(
        select(AnimalWeightLog)
        .where(AnimalWeightLog.animal_id == animal_id)
        .order_by(AnimalWeightLog.measured_at.desc())
        .limit(50)
    )
    logs = result.scalars().all()
    return [WeightLogResponse.model_validate(log) for log in logs]


# --- Birth / litter event endpoint ---


class BirthRequest(BaseModel):
    litter_count: int = Field(..., ge=1, le=20)
    birth_date: date | None = None  # defaults to today


@router.post(
    "/{animal_id}/birth",
    status_code=status.HTTP_201_CREATED,
)
async def register_birth(
    animal_id: uuid.UUID,
    data: BirthRequest,
    current_user: User = Depends(require_permission("animals.write")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Register a birth event for a pregnant animal.
    Creates litter_count new animals of the same species + breed,
    assigns them to the mother's current kennel (ignoring capacity),
    and sets their birth date to today.
    Returns list of created offspring.
    """
    from sqlalchemy import text as sql_text
    from src.app.models.animal import Animal, AgeGroup, AnimalStatus, AlteredStatus
    from src.app.models.animal_breed import AnimalBreed
    from src.app.models.kennel import KennelStay

    svc = AnimalService(db)
    mother = await svc.get_animal(organization_id, animal_id)
    if mother is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found"
        )

    today = data.birth_date or datetime.now(timezone.utc).date()

    # Find mother's current kennel
    stay_result = await db.execute(
        sql_text("""
            SELECT kennel_id FROM kennel_stays
            WHERE animal_id = :animal_id AND end_at IS NULL
            LIMIT 1
        """),
        {"animal_id": str(mother.id)},
    )
    current_kennel_row = stay_result.first()
    current_kennel_id = current_kennel_row[0] if current_kennel_row else None

    # Get mother's breeds for offspring
    breed_ids = [ab.breed_id for ab in (mother.animal_breeds or [])]

    created = []
    for i in range(data.litter_count):
        public_code = await svc._generate_public_code(organization_id)
        offspring = Animal(
            id=uuid.uuid4(),
            organization_id=organization_id,
            public_code=public_code,
            name=f"{mother.name} – mládě {i + 1}",
            species=mother.species,
            sex="unknown",
            status=AnimalStatus.INTAKE,
            altered_status=AlteredStatus.UNKNOWN,
            age_group=AgeGroup.BABY,
            birth_date_estimated=today,
            public_visibility=False,
            featured=False,
            is_dewormed=False,
            is_aggressive=False,
            is_pregnant=False,
        )
        db.add(offspring)
        await db.flush()

        # Create intake record for offspring (reason: birth)
        from src.app.models.intake import Intake, IntakeReason as IR

        birth_intake = Intake(
            organization_id=organization_id,
            animal_id=offspring.id,
            reason=IR.BIRTH,
            intake_date=today,
            notes=f"Narozeno – {mother.name}",
            created_by_id=current_user.id,
        )
        db.add(birth_intake)

        # Copy breeds from mother
        for breed_id in breed_ids:
            db.add(AnimalBreed(animal_id=offspring.id, breed_id=breed_id))

        # Place in mother's kennel (ignoring capacity)
        if current_kennel_id:
            db.add(
                KennelStay(
                    id=uuid.uuid4(),
                    organization_id=organization_id,
                    animal_id=offspring.id,
                    kennel_id=current_kennel_id,
                    start_at=datetime.now(timezone.utc),
                    reason="Narozeno",
                    moved_by_user_id=current_user.id,
                )
            )

        created.append(
            {
                "id": str(offspring.id),
                "public_code": public_code,
                "name": offspring.name,
            }
        )
        await db.flush()

    # Clear expected litter date and unmark pregnant on mother
    mother.expected_litter_date = None
    mother.is_pregnant = False

    await db.commit()
    return {"created": len(created), "offspring": created}


# --- BCS log endpoints ---


@router.post(
    "/{animal_id}/bcs",
    response_model=BCSLogResponse,
    status_code=status.HTTP_201_CREATED,
)
async def log_bcs(
    animal_id: uuid.UUID,
    data: BCSLogCreate,
    current_user: User = Depends(require_permission("animals.write")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Log a Body Condition Score (BCS 1–9) measurement for an animal."""
    svc = AnimalService(db)
    animal = await svc.get_animal(organization_id, animal_id)
    if animal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found"
        )

    measured_at = data.measured_at or datetime.now(timezone.utc)
    log = AnimalBCSLog(
        animal_id=animal_id,
        bcs=data.bcs,
        measured_at=measured_at,
        notes=data.notes,
        recorded_by_user_id=current_user.id,
    )
    db.add(log)
    # Update current BCS on animal
    animal.bcs = data.bcs
    await db.commit()
    await db.refresh(log)
    return BCSLogResponse.model_validate(log)


@router.get(
    "/{animal_id}/bcs",
    response_model=list[BCSLogResponse],
)
async def get_bcs_history(
    animal_id: uuid.UUID,
    current_user: User = Depends(require_permission("animals.read")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Get BCS history for an animal, newest first."""
    svc = AnimalService(db)
    animal = await svc.get_animal(organization_id, animal_id)
    if animal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found"
        )

    result = await db.execute(
        select(AnimalBCSLog)
        .where(AnimalBCSLog.animal_id == animal_id)
        .order_by(AnimalBCSLog.measured_at.desc())
        .limit(50)
    )
    logs = result.scalars().all()
    return [BCSLogResponse.model_validate(log) for log in logs]


# --- Kennel history endpoint ---


@router.get("/{animal_id}/kennel-history")
async def get_animal_kennel_history(
    animal_id: uuid.UUID,
    current_user: User = Depends(require_permission("animals.read")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Get kennel assignment history for an animal."""
    from src.app.models.kennel import KennelStay, Kennel

    svc = AnimalService(db)
    animal = await svc.get_animal(organization_id, animal_id)
    if animal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found"
        )

    result = await db.execute(
        select(KennelStay, Kennel.code)
        .join(Kennel, KennelStay.kennel_id == Kennel.id)
        .where(
            KennelStay.animal_id == animal_id,
            KennelStay.organization_id == organization_id,
        )
        .order_by(KennelStay.start_at.asc())
    )
    rows = result.all()
    return [
        {
            "kennel_code": code,
            "assigned_at": stay.start_at.isoformat() if stay.start_at else None,
            "released_at": stay.end_at.isoformat() if stay.end_at else None,
        }
        for stay, code in rows
    ]


# --- Daily count stats endpoint ---


@router.get("/stats/daily-count")
async def get_daily_animal_count(
    days: int = Query(90, ge=7, le=365),
    current_user: User = Depends(require_permission("animals.read")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Return daily animal count for the last N days. Single query with generate_series."""
    result = await db.execute(
        text("""
            SELECT 
                d.day,
                COUNT(DISTINCT a.id)::int as count
            FROM generate_series(
                CURRENT_DATE - (:days - 1) * INTERVAL '1 day',
                CURRENT_DATE,
                '1 day'::interval
            ) AS d(day)
            LEFT JOIN animals a ON a.organization_id = :org_id AND a.deleted_at IS NULL
            LEFT JOIN intakes i ON i.animal_id = a.id 
                AND i.intake_date <= d.day 
                AND (i.deleted_at IS NULL OR i.deleted_at > d.day)
            GROUP BY d.day
            ORDER BY d.day ASC
        """),
        {"org_id": str(organization_id), "days": days},
    )
    rows = result.fetchall()
    return [
        {
            "date": row.day.strftime("%Y-%m-%d")
            if hasattr(row.day, "strftime")
            else str(row.day)[:10],
            "count": row.count,
        }
        for row in rows
    ]


# --- Identifier endpoints ---


@router.post(
    "/{animal_id}/identifiers",
    response_model=AnimalIdentifierResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_identifier(
    animal_id: uuid.UUID,
    data: AnimalIdentifierCreate,
    current_user: User = Depends(require_permission("animals.write")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Add an identifier (microchip, tattoo, etc.) to an animal."""
    svc = AnimalService(db)
    animal = await svc.get_animal(organization_id, animal_id)
    if animal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found"
        )

    identifier = AnimalIdentifier(
        id=uuid.uuid4(),
        animal_id=animal_id,
        type=data.type,
        value=data.value,
        registry=data.registry if hasattr(data, "registry") else None,
        issued_at=data.issued_at if hasattr(data, "issued_at") else None,
    )
    db.add(identifier)
    await db.flush()
    await db.refresh(identifier)
    return AnimalIdentifierResponse.model_validate(identifier)


@router.delete(
    "/{animal_id}/identifiers/{identifier_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_identifier(
    animal_id: uuid.UUID,
    identifier_id: uuid.UUID,
    current_user: User = Depends(require_permission("animals.write")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Remove an identifier from an animal."""
    result = await db.execute(
        select(AnimalIdentifier).where(
            AnimalIdentifier.id == identifier_id,
            AnimalIdentifier.animal_id == animal_id,
        )
    )
    identifier = result.scalar_one_or_none()
    if identifier is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Identifier not found"
        )
    await db.delete(identifier)


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


@breed_router.get(
    "/{breed_id}/color-images", response_model=list[BreedColorImageResponse]
)
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


@router.patch("/{animal_id}/walked", response_model=AnimalResponse)
async def mark_animal_walked(
    animal_id: uuid.UUID,
    current_user: User = Depends(require_permission("tasks.write")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Mark an animal as walked (sets last_walked_at timestamp and creates event)."""
    result = await db.execute(
        select(Animal).where(
            Animal.id == animal_id,
            Animal.organization_id == organization_id,
        )
    )
    animal = result.scalar_one_or_none()
    if not animal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Animal not found"
        )

    now = datetime.utcnow()
    animal.last_walked_at = now

    event = AnimalEvent(
        id=uuid.uuid4(),
        organization_id=organization_id,
        animal_id=animal_id,
        event_type=AnimalEventType.WALK,
        occurred_at=now,
        title="Venčení",
        description="Zvíře bylo venčeno",
        related_user_id=current_user.id,
    )
    db.add(event)

    await db.commit()
    await db.refresh(animal)

    return await _build_animal_response(animal, db)
