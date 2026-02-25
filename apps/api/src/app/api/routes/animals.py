import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select, text, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.dependencies.auth import (
    get_current_user,
    get_current_organization_id,
    require_permission,
)
from src.app.api.dependencies.db import get_db
from src.app.models.animal import Animal, Species
from src.app.models.kennel import Kennel, Zone
from src.app.services.legal_deadline import (
    compute_legal_deadline,
    compute_legal_deadline_from_settings,
)
from src.app.schemas.org_settings import get_org_settings
from src.app.models.organization import Organization
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
    org_legal=None,
) -> AnimalResponse:
    """Build AnimalResponse from ORM object with nested breeds and identifiers."""
    breed_ids_list = [ab.breed_id for ab in (animal.animal_breeds or [])]
    i18n_map: dict[str, str] = {}
    if breed_ids_list:
        i18n_rows = await db.execute(
            select(BreedI18n.breed_id, BreedI18n.name).where(
                BreedI18n.breed_id.in_(breed_ids_list), BreedI18n.locale == "cs"
            )
        )
        i18n_map = {str(r.breed_id): r.name for r in i18n_rows}
    breeds = [
        AnimalBreedResponse(
            breed_id=ab.breed_id,
            breed_name=ab.breed.name,
            breed_species=ab.breed.species,
            percent=ab.percent,
            display_name=i18n_map.get(str(ab.breed_id)),
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

    # Překlad barvy z color_i18n
    if animal.color:
        color_i18n_result = await db.execute(
            text(
                "SELECT name FROM color_i18n"
                " WHERE code = :code AND locale = 'cs' AND organization_id IS NULL"
                " LIMIT 1"
            ),
            {"code": animal.color},
        )
        color_name = color_i18n_result.scalar_one_or_none()
        resp.color_display_name = color_name

    # default_image_url is now stored in DB - use it directly
    # (no query needed)

    # Use pre-loaded kennel data if provided (list endpoint)
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
        intake_info = intake_data[animal_id_str]
        resp.current_intake_date = intake_info.get("intake_date")
        resp.current_intake_reason = intake_info.get("reason")
        resp.notice_published_at = intake_info.get("notice_published_at")
        resp.finder_claims_ownership = intake_info.get("finder_claims_ownership")
        resp.municipality_irrevocably_transferred = intake_info.get(
            "municipality_irrevocably_transferred"
        )
    elif intake_data is None:
        # Fallback: single animal fetch - query if not provided
        try:
            intake_result = await db.execute(
                text("""
                    SELECT intake_date, reason, notice_published_at, 
                           finder_claims_ownership, municipality_irrevocably_transferred
                    FROM intakes
                    WHERE animal_id = :animal_id AND deleted_at IS NULL
                    ORDER BY intake_date DESC
                    LIMIT 1
                """),
                {"animal_id": animal_id_str},
            )
            intake_row = intake_result.first()
            if intake_row:
                resp.current_intake_date = intake_row[0]
                resp.current_intake_reason = intake_row[1]
                resp.notice_published_at = intake_row[2]
                resp.finder_claims_ownership = intake_row[3]
                resp.municipality_irrevocably_transferred = intake_row[4]
        except Exception:
            pass

    # Compute legal deadline if this is a found animal
    if resp.current_intake_reason == "found" and resp.notice_published_at is not None:
        if org_legal is not None:
            deadline_info = compute_legal_deadline_from_settings(
                announced_at=resp.notice_published_at,
                received_at=resp.current_intake_date,
                found_at=resp.current_intake_date,
                finder_keeps=resp.finder_claims_ownership,
                org_legal=org_legal,
            )
        else:
            deadline_info = compute_legal_deadline(
                notice_published_at=resp.notice_published_at,
                shelter_received_at=resp.current_intake_date,
                finder_claims_ownership=resp.finder_claims_ownership,
                municipality_irrevocably_transferred=resp.municipality_irrevocably_transferred,
            )
        resp.legal_deadline_at = deadline_info.deadline_at
        resp.legal_deadline_type = deadline_info.deadline_type
        resp.legal_deadline_days_left = deadline_info.days_left
        resp.legal_deadline_state = deadline_info.deadline_state
        resp.legal_deadline_label = deadline_info.label

    # Compute website deadline state (if animal is published)
    resp.website_published_at = animal.website_published_at
    resp.website_deadline_at = animal.website_deadline_at

    if animal.website_published_at and animal.website_deadline_at:
        from datetime import date

        today = date.today()
        days_left = (animal.website_deadline_at - today).days

        resp.website_days_left = days_left

        if days_left < 0:
            resp.website_deadline_state = "expired"
        else:
            resp.website_deadline_state = "waiting"
    else:
        resp.website_days_left = None
        resp.website_deadline_state = "not_published"

    # Generate thumbnail URL from primary_photo_url (user-uploaded photos)
    if animal.primary_photo_url:
        resp.thumbnail_url = animal.primary_photo_url.replace(
            "/animal-photos/", "/animal-thumbnails/"
        )
    # Fallback: thumbnail from default image
    elif animal.default_thumbnail_url:
        resp.thumbnail_url = animal.default_thumbnail_url

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


@router.get("/ids", response_model=dict)
async def list_animal_ids(
    current_user: User = Depends(require_permission("animals.read")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Lightweight endpoint - returns just animal IDs for navigation."""
    from sqlalchemy import select, func
    from src.app.models.animal import Animal

    # Just count - no relationships needed
    result = await db.execute(
        select(Animal.id, Animal.name)
        .where(Animal.organization_id == organization_id)
        .order_by(Animal.name)
    )
    items = result.fetchall()
    return {"ids": [str(r[0]) for r in items], "count": len(items)}


@router.get("/lightweight-for-kennels", response_model=list)
async def list_animals_lightweight_for_kennels(
    current_user: User = Depends(require_permission("animals.read")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Lightweight endpoint for kennels page drag-drop.
    Returns only fields needed for kennel assignment UI.
    Uses single optimized query with JOIN to get current kennel.
    """
    # Query: only needed fields + current kennel via JOIN
    query = text("""
        SELECT
            a.id::text,
            a.name,
            a.species::text,
            a.sex::text,
            a.status::text,
            a.altered_status::text,
            a.is_aggressive,
            a.is_special_needs,
            a.primary_photo_url,
            a.public_code,
            ks.kennel_id::text AS current_kennel_id,
            k.name AS current_kennel_name,
            k.code AS current_kennel_code,
            i.intake_date AS current_intake_date
        FROM animals a
        LEFT JOIN kennel_stays ks ON ks.animal_id = a.id AND ks.end_at IS NULL
        LEFT JOIN kennels k ON k.id = ks.kennel_id AND k.deleted_at IS NULL
        LEFT JOIN LATERAL (
            SELECT intake_date FROM intakes
            WHERE intakes.animal_id = a.id AND intakes.deleted_at IS NULL
            ORDER BY intakes.intake_date DESC LIMIT 1
        ) i ON true
        WHERE a.organization_id = :org_id AND a.deleted_at IS NULL
        ORDER BY a.name
    """)
    result = await db.execute(query, {"org_id": str(organization_id)})
    rows = result.fetchall()

    return [
        {
            "id": str(r[0]),
            "name": r[1],
            "species": r[2],
            "sex": r[3],
            "status": r[4],
            "altered_status": r[5],
            "is_aggressive": r[6] or False,
            "is_special_needs": r[7] or False,
            "primary_photo_url": r[8],
            "public_code": r[9],
            "current_kennel_id": r[10],
            "current_kennel_name": r[11],
            "current_kennel_code": r[12],
            "current_intake_date": r[13].isoformat() if r[13] else None,
        }
        for r in rows
    ]


@router.get("/kennels-data")
async def get_kennels_data(
    zone_id: str | None = Query(None),
    status: str | None = Query(None),
    type: str | None = Query(None),
    size_category: str | None = Query(None),
    q: str | None = Query(None),
    current_user: User = Depends(require_permission("kennels.read")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Combined endpoint for kennels page - returns both kennels and animals in one call.
    Optimized for drag-drop operations.
    """
    # Build kennel filters
    kennel_filters = [
        Kennel.organization_id == organization_id,
        Kennel.deleted_at.is_(None),
    ]
    if zone_id:
        kennel_filters.append(Kennel.zone_id == uuid.UUID(zone_id))
    if status:
        kennel_filters.append(Kennel.status == status)
    if type:
        kennel_filters.append(Kennel.type == type)
    if size_category:
        kennel_filters.append(Kennel.size_category == size_category)
    if q:
        kennel_filters.append(
            or_(Kennel.name.ilike(f"%{q}%"), Kennel.code.ilike(f"%{q}%"))
        )

    # Get kennels with zones
    kennel_query = (
        select(Kennel, Zone.name.label("zone_name"))
        .outerjoin(Zone, Kennel.zone_id == Zone.id)
        .where(and_(*kennel_filters))
        .order_by(Kennel.code)
    )
    kennel_result = await db.execute(kennel_query)
    kennels = []
    for row in kennel_result.fetchall():
        kennel, zone_name = row
        kennels.append(
            {
                "id": str(kennel.id),
                "name": kennel.name,
                "code": kennel.code,
                "type": kennel.type,
                "status": kennel.status,
                "size_category": kennel.size_category,
                "capacity": kennel.capacity,
                "zone_id": str(kennel.zone_id) if kennel.zone_id else None,
                "zone_name": zone_name,
            }
        )

    # Get animals lightweight
    animals_query = text("""
        SELECT
            a.id::text,
            a.name,
            a.species::text,
            a.sex::text,
            a.status::text,
            a.altered_status::text,
            a.is_aggressive,
            a.is_special_needs,
            a.primary_photo_url,
            a.public_code,
            ks.kennel_id::text AS current_kennel_id,
            k.name AS current_kennel_name,
            k.code AS current_kennel_code,
            i.intake_date AS current_intake_date
        FROM animals a
        LEFT JOIN kennel_stays ks ON ks.animal_id = a.id AND ks.end_at IS NULL
        LEFT JOIN kennels k ON k.id = ks.kennel_id AND k.deleted_at IS NULL
        LEFT JOIN LATERAL (
            SELECT intake_date FROM intakes
            WHERE intakes.animal_id = a.id AND intakes.deleted_at IS NULL
            ORDER BY intakes.intake_date DESC LIMIT 1
        ) i ON true
        WHERE a.organization_id = :org_id AND a.deleted_at IS NULL
        ORDER BY a.name
    """)
    animals_result = await db.execute(animals_query, {"org_id": str(organization_id)})
    animals = []
    terminal_statuses = ("deceased", "adopted", "transferred", "returned_to_owner")
    for r in animals_result.fetchall():
        if (
            r[4] not in terminal_statuses and r[13]
        ):  # status not terminal and has intake_date
            animals.append(
                {
                    "id": str(r[0]),
                    "name": r[1],
                    "species": r[2],
                    "sex": r[3],
                    "status": r[4],
                    "altered_status": r[5],
                    "is_aggressive": r[6] or False,
                    "is_special_needs": r[7] or False,
                    "primary_photo_url": r[8],
                    "public_code": r[9],
                    "current_kennel_id": r[10],
                    "current_kennel_name": r[11],
                    "current_kennel_code": r[12],
                    "current_intake_date": r[13].isoformat() if r[13] else None,
                }
            )

    return {"kennels": kennels, "animals": animals}


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
    # Load org settings for configurable legal deadline
    org = await db.get(Organization, organization_id)
    org_legal = get_org_settings(org).legal if org else None
    return await _build_animal_response(animal, db, org_legal=org_legal)


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
    collar_colors: list[str | None] | None = (
        None  # Optional collar colors for each offspring
    )
    naming_scheme: str = "number"  # "number", "letter", or "color"
    mother_lactating: bool = False  # Set mother as lactating after birth

    @field_validator("collar_colors")
    @classmethod
    def validate_collar_colors(cls, v, info):
        if v is None:
            return v
        litter_count = info.data.get("litter_count")
        if litter_count and len(v) != litter_count:
            raise ValueError(
                f"collar_colors length ({len(v)}) must equal litter_count ({litter_count})"
            )

        valid_colors = [
            "red",
            "blue",
            "green",
            "yellow",
            "orange",
            "purple",
            "pink",
            "brown",
            None,
            "none",
        ]
        for color in v:
            if color not in valid_colors:
                raise ValueError(
                    f"Invalid collar color: {color}. Must be one of {valid_colors}"
                )
        return v

    @field_validator("naming_scheme")
    @classmethod
    def validate_naming_scheme(cls, v):
        valid_schemes = ["number", "letter", "color"]
        if v not in valid_schemes:
            raise ValueError(
                f"Invalid naming_scheme: {v}. Must be one of {valid_schemes}"
            )
        return v


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

        # Get collar color for this offspring
        collar_color = None
        if data.collar_colors and i < len(data.collar_colors):
            color = data.collar_colors[i]
            collar_color = color if color and color != "none" else None

        # Generate name based on naming scheme
        if data.naming_scheme == "letter":
            # A, B, C, ... Z, AA, AB, ...
            letter_index = i
            letters = ""
            while True:
                letters = chr(65 + (letter_index % 26)) + letters
                letter_index //= 26
                if letter_index == 0:
                    break
                letter_index -= 1
            offspring_name = f"{mother.name} – {letters}"
        elif data.naming_scheme == "color" and collar_color:
            # Use color name in Czech (map to i18n keys)
            color_names_cs = {
                "red": "červený",
                "blue": "modrý",
                "green": "zelený",
                "yellow": "žlutý",
                "orange": "oranžový",
                "purple": "fialový",
                "pink": "růžový",
                "brown": "hnědý",
            }
            color_name = color_names_cs.get(collar_color, collar_color)
            offspring_name = f"{mother.name} – {color_name}"
        else:
            # Default: number (1, 2, 3, ...)
            offspring_name = f"{mother.name} – mládě {i + 1}"

        offspring = Animal(
            id=uuid.uuid4(),
            organization_id=organization_id,
            public_code=public_code,
            name=offspring_name,
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
            collar_color=collar_color,
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
                    moved_by=current_user.id,
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
    if data.mother_lactating:
        mother.is_lactating = True

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

    from datetime import datetime, timedelta, timezone

    result = await db.execute(
        select(KennelStay, Kennel.code)
        .join(Kennel, KennelStay.kennel_id == Kennel.id)
        .where(
            KennelStay.animal_id == animal_id,
            KennelStay.organization_id == organization_id,
            Kennel.deleted_at.is_(None),  # Only show stays for non-deleted kennels
        )
        .where(
            # Show active stays (no end_at) OR stays that ended in the last 30 days
            (KennelStay.end_at.is_(None))
            | (KennelStay.end_at >= datetime.now(timezone.utc) - timedelta(days=30))
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
            JOIN intakes i ON i.organization_id = :org_id
                AND i.deleted_at IS NULL
                AND i.intake_date <= d.day
            JOIN animals a ON a.id = i.animal_id
                AND a.deleted_at IS NULL
                AND (a.outcome_date IS NULL OR a.outcome_date > d.day)
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

    await db.commit()
    await db.refresh(animal)

    return await _build_animal_response(animal, db)


@router.post("/{animal_id}/publish-to-website", response_model=AnimalResponse)
async def publish_animal_to_website(
    animal_id: uuid.UUID,
    type: str = Query(
        "shelter",
        description="Publication type: 'shelter' (4 months) or 'finder' (2 months)",
    ),
    current_user: User = Depends(require_permission("animals.write")),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """
    Mark a found animal as published on the website.

    - type='shelter': Animal in shelter, 4-month waiting period, status → waiting_adoption
    - type='finder': Finder keeps animal, 2-month waiting period, status → with_owner

    Only for animals with intake_reason='found' and status in ['intake', 'quarantine'].
    """
    from src.app.models.animal import AnimalStatus
    from src.app.models.intake import Intake, IntakeReason
    from sqlalchemy.orm import selectinload
    from dateutil.relativedelta import relativedelta

    # Fetch animal with intake
    result = await db.execute(
        select(Animal)
        .options(selectinload(Animal.intakes))
        .where(Animal.id == animal_id, Animal.organization_id == organization_id)
    )
    animal = result.scalar_one_or_none()

    if not animal:
        raise HTTPException(status_code=404, detail="Animal not found")

    # Verify it's a found animal
    active_intake = next(
        (
            i
            for i in animal.intakes
            if i.intake_date and not i.outcome_date and not i.deleted_at
        ),
        None,
    )
    if not active_intake or active_intake.reason != IntakeReason.FOUND:
        raise HTTPException(
            status_code=400,
            detail="Only found animals can be published to website with waiting period",
        )

    # Verify current status allows publication
    if animal.status not in [AnimalStatus.INTAKE, AnimalStatus.QUARANTINE]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot publish animal with status '{animal.status}'",
        )

    # Already published?
    if animal.website_published_at:
        raise HTTPException(
            status_code=400, detail="Animal already published to website"
        )

    # Validate type parameter
    if type not in ["shelter", "finder"]:
        raise HTTPException(
            status_code=400, detail="Invalid type. Must be 'shelter' or 'finder'"
        )

    # Set publication date and compute deadline based on type
    today = date.today()
    if type == "shelter":
        # Animal in shelter: 4-month waiting period
        deadline = today + relativedelta(months=4)
        new_status = AnimalStatus.WAITING_ADOPTION
    else:  # type == "finder"
        # Finder keeps animal: 2-month waiting period
        deadline = today + relativedelta(months=2)
        new_status = AnimalStatus.WITH_OWNER

    animal.website_published_at = today
    animal.website_deadline_at = deadline
    animal.website_deadline_type = type
    animal.website_published_by_user_id = current_user.id
    animal.status = new_status

    await db.commit()
    await db.refresh(animal)

    # Log audit event
    from src.app.services.audit_service import AuditService

    audit_service = AuditService(db)
    await audit_service.log_event(
        organization_id=organization_id,
        entity_type="animal",
        entity_id=animal.id,
        action="publish_to_website",
        user_id=current_user.id,
        before_value=None,
        after_value={
            "website_published_at": str(today),
            "website_deadline_at": str(deadline),
            "website_deadline_type": type,
            "status": new_status.value
            if hasattr(new_status, "value")
            else str(new_status),
        },
    )

    # Build response
    return await _build_animal_response(animal, db)
