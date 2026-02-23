import uuid
from datetime import date, datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from decimal import Decimal

PREGNANCY_MIN_AGE_DAYS = 270  # ~9 months

from src.app.models.animal import Animal, AnimalStatus, Species, Sex
from src.app.models.animal_breed import AnimalBreed
from src.app.models.animal_identifier import AnimalIdentifier
from src.app.models.breed import Breed
from src.app.models.kennel import KennelStay
from src.app.schemas.animal import AnimalCreate, AnimalUpdate
from src.app.services.audit_service import AuditService


def _animal_to_dict(animal: Animal) -> dict:
    """Serialize animal scalar fields to dict for audit logging."""
    return {
        "id": str(animal.id),
        "name": animal.name,
        "species": animal.species,
        "sex": animal.sex,
        "status": animal.status,
        "altered_status": animal.altered_status,
        "age_group": animal.age_group,
        "size_estimated": animal.size_estimated,
        "color": animal.color,
        "coat": animal.coat,
        "weight_current_kg": float(animal.weight_current_kg)
        if animal.weight_current_kg
        else None,
        "weight_estimated_kg": float(animal.weight_estimated_kg)
        if animal.weight_estimated_kg
        else None,
        "status_reason": animal.status_reason,
        "outcome_date": str(animal.outcome_date) if animal.outcome_date else None,
        "description": animal.description,
        "public_visibility": animal.public_visibility,
        "featured": animal.featured,
        "public_code": animal.public_code,
    }


class AnimalService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.audit = AuditService(db)

    async def _compute_default_image_url(
        self,
        species: str,
        breed_ids: list[uuid.UUID] | None,
        color: str | None,
    ) -> "DefaultAnimalImage | None":
        """Compute default image based on species, breed, and color. Returns the full object."""
        from src.app.models.file import DefaultAnimalImage
        from sqlalchemy import or_

        breed_id = breed_ids[0] if breed_ids else None
        species_enum = Species(species)

        queries = []
        if breed_id and color:
            queries.append(
                select(DefaultAnimalImage)
                .where(
                    DefaultAnimalImage.species == species_enum,
                    DefaultAnimalImage.breed_id == breed_id,
                    DefaultAnimalImage.color_pattern == color,
                    DefaultAnimalImage.is_active == True,
                )
                .order_by(DefaultAnimalImage.priority.desc())
                .limit(1)
            )
        if breed_id:
            queries.append(
                select(DefaultAnimalImage)
                .where(
                    DefaultAnimalImage.species == species_enum,
                    DefaultAnimalImage.breed_id == breed_id,
                    DefaultAnimalImage.color_pattern.is_(None),
                    DefaultAnimalImage.is_active == True,
                )
                .order_by(DefaultAnimalImage.priority.desc())
                .limit(1)
            )
        if color:
            queries.append(
                select(DefaultAnimalImage)
                .where(
                    DefaultAnimalImage.species == species_enum,
                    DefaultAnimalImage.breed_id.is_(None),
                    DefaultAnimalImage.color_pattern == color,
                    DefaultAnimalImage.is_active == True,
                )
                .order_by(DefaultAnimalImage.priority.desc())
                .limit(1)
            )
        queries.append(
            select(DefaultAnimalImage)
            .where(
                DefaultAnimalImage.species == species,
                DefaultAnimalImage.breed_id.is_(None),
                DefaultAnimalImage.color_pattern.is_(None),
                DefaultAnimalImage.is_active == True,
            )
            .order_by(DefaultAnimalImage.priority.desc())
            .limit(1)
        )

        for q in queries:
            result = await self.db.execute(q)
            img = result.scalar_one_or_none()
            if img:
                return img

        return None

    async def _generate_public_code(self, organization_id: uuid.UUID) -> str:
        year = datetime.now(timezone.utc).year
        prefix = f"A-{year}-"
        # Query globally: public_code has a global unique constraint,
        # so the sequence must be unique across all organizations.
        result = await self.db.execute(
            select(Animal.public_code).where(
                Animal.public_code.like(f"{prefix}%"),
            )
        )
        codes = result.scalars().all()
        if codes:
            # Parse all numbers and find the max
            nums = []
            for code in codes:
                try:
                    if code:
                        nums.append(int(code.split("-")[-1]))
                except (ValueError, IndexError):
                    pass
            seq = max(nums) + 1 if nums else 1
        else:
            seq = 1
        return f"{prefix}{seq:06d}"

    async def create_animal(
        self,
        organization_id: uuid.UUID,
        data: AnimalCreate,
        actor_id: uuid.UUID,
        ip: str | None = None,
        user_agent: str | None = None,
    ) -> Animal:
        public_code = await self._generate_public_code(organization_id)

        # With use_enum_values=True, Pydantic already converted to strings
        animal = Animal(
            id=uuid.uuid4(),
            organization_id=organization_id,
            public_code=public_code,
            name=data.name,
            species=data.species,
            sex=data.sex,
            status=data.status,
            altered_status=data.altered_status,
            birth_date_estimated=data.birth_date_estimated,
            age_group=data.age_group,
            color=data.color,
            coat=data.coat,
            size_estimated=data.size_estimated,
            weight_current_kg=data.weight_current_kg,
            weight_estimated_kg=data.weight_estimated_kg,
            is_dewormed=data.is_dewormed,
            is_aggressive=data.is_aggressive,
            status_reason=data.status_reason,
            outcome_date=data.outcome_date,
            description=data.description,
            public_visibility=data.public_visibility,
            featured=data.featured,
            is_pregnant=data.is_pregnant,
            bcs=data.bcs,
            expected_litter_date=data.expected_litter_date,
            behavior_notes=data.behavior_notes,
            is_special_needs=data.is_special_needs,
        )
        self.db.add(animal)
        await self.db.flush()

        # Add breeds
        if data.breeds:
            for entry in data.breeds:
                ab = AnimalBreed(
                    animal_id=animal.id,
                    breed_id=entry.breed_id,
                    percent=entry.percent,
                )
                self.db.add(ab)
            await self.db.flush()

            # Auto-fill weight_estimated_kg from breed average if not provided
            if animal.weight_estimated_kg is None and animal.weight_current_kg is None:
                breed_result = await self.db.execute(
                    select(Breed).where(Breed.id == data.breeds[0].breed_id)
                )
                breed = breed_result.scalar_one_or_none()
                if breed:
                    sex = str(data.sex) if hasattr(data.sex, "value") else data.sex
                    if (
                        sex == "female"
                        and breed.weight_female_min
                        and breed.weight_female_max
                    ):
                        avg = (
                            Decimal(str(breed.weight_female_min))
                            + Decimal(str(breed.weight_female_max))
                        ) / 2
                        animal.weight_estimated_kg = avg
                    elif (
                        sex in ("male", "unknown")
                        and breed.weight_male_min
                        and breed.weight_male_max
                    ):
                        avg = (
                            Decimal(str(breed.weight_male_min))
                            + Decimal(str(breed.weight_male_max))
                        ) / 2
                        animal.weight_estimated_kg = avg
                    await self.db.flush()

        # Add identifiers
        if data.identifiers:
            for ident in data.identifiers:
                # Convert enum to string value if needed
                type_val = (
                    ident.type.value if hasattr(ident.type, "value") else ident.type
                )
                ai = AnimalIdentifier(
                    id=uuid.uuid4(),
                    organization_id=organization_id,
                    animal_id=animal.id,
                    type=type_val,
                    value=ident.value,
                    registry=ident.registry,
                    issued_at=ident.issued_at,
                )
                self.db.add(ai)
            await self.db.flush()

        # Compute and save default image URL + thumbnail
        breed_ids = [entry.breed_id for entry in data.breeds] if data.breeds else None
        default_img = await self._compute_default_image_url(
            species=(
                data.species.value if hasattr(data.species, "value") else data.species
            ).lower(),
            breed_ids=breed_ids,
            color=data.color,
        )
        if default_img:
            animal.default_image_url = default_img.public_url
            animal.default_thumbnail_url = default_img.thumbnail_url
        else:
            animal.default_image_url = None
            animal.default_thumbnail_url = None
        await self.db.flush()

        # Audit log
        await self.audit.log_action(
            organization_id=organization_id,
            actor_user_id=actor_id,
            action="create",
            entity_type="animal",
            entity_id=animal.id,
            after=_animal_to_dict(animal),
            ip=ip,
            user_agent=user_agent,
        )

        # Reload with relationships
        await self.db.refresh(animal)
        return animal

    async def get_animal(
        self,
        organization_id: uuid.UUID,
        animal_id: uuid.UUID,
    ) -> Animal | None:
        from sqlalchemy.orm import selectinload

        result = await self.db.execute(
            select(Animal)
            .options(
                selectinload(Animal.animal_breeds).selectinload(AnimalBreed.breed),
                selectinload(Animal.identifiers),
            )
            .where(
                Animal.id == animal_id,
                Animal.organization_id == organization_id,
                Animal.deleted_at.is_(None),
            )
        )
        return result.scalar_one_or_none()

    async def list_animals(
        self,
        organization_id: uuid.UUID,
        page: int = 1,
        page_size: int = 20,
        species: str | None = None,
        status: str | None = None,
        sex: str | None = None,
        search: str | None = None,
        available_for_intake: bool = False,
    ) -> tuple[list[Animal], int, bool, dict]:
        from sqlalchemy.orm import selectinload
        from sqlalchemy import text

        base = select(Animal).where(
            Animal.organization_id == organization_id,
            Animal.deleted_at.is_(None),
        )

        if species:
            base = base.where(Animal.species == species)
        if status and status != "all":
            base = base.where(Animal.status == status)
        if sex:
            base = base.where(Animal.sex == sex)
        if search:
            base = base.where(Animal.name.ilike(f"%{search}%"))

        if available_for_intake:
            base = base.where(Animal.status.not_in(["intake", "hotel"]))

        # Use has_more pattern: fetch page_size + 1 to determine if there's more
        fetch_size = page_size + 1
        items_q = (
            base.options(
                selectinload(Animal.animal_breeds).joinedload(AnimalBreed.breed),
                selectinload(Animal.identifiers),
                selectinload(Animal.tags),
            )
            .order_by(Animal.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(fetch_size)
        )
        result = await self.db.execute(items_q)
        items = list(result.scalars().all())

        has_more = len(items) > page_size
        if has_more:
            items = items[:page_size]

        # Bulk load kennel stays and intake dates
        animal_ids = [a.id for a in items]
        kennel_data: dict = {}
        intake_data: dict = {}

        if animal_ids:
            # Bulk load kennel stays
            kennel_result = await self.db.execute(
                text("""
                    SELECT ks.animal_id::text, k.id::text, k.name, k.code
                    FROM kennel_stays ks
                    JOIN kennels k ON k.id = ks.kennel_id
                    WHERE ks.animal_id = ANY(:animal_ids) AND ks.end_at IS NULL
                """),
                {"animal_ids": [str(aid) for aid in animal_ids]},
            )
            for row in kennel_result.fetchall():
                kennel_data[row[0]] = {
                    "kennel_id": row[1],
                    "kennel_name": row[2],
                    "kennel_code": row[3],
                }

            # Bulk load intake dates with legal fields
            intake_result = await self.db.execute(
                text("""
                    SELECT animal_id::text, MAX(intake_date) as intake_date, 
                           MAX(reason) as reason,
                           MAX(notice_published_at) as notice_published_at,
                           MAX(finder_claims_ownership::text)::bool as finder_claims_ownership,
                           MAX(municipality_irrevocably_transferred::text)::bool as municipality_irrevocably_transferred
                    FROM intakes
                    WHERE animal_id = ANY(:animal_ids) AND deleted_at IS NULL
                    GROUP BY animal_id
                """),
                {"animal_ids": [str(aid) for aid in animal_ids]},
            )
            for row in intake_result.fetchall():
                intake_data[row[0]] = {
                    "intake_date": row[1],
                    "reason": row[2],
                    "notice_published_at": row[3],
                    "finder_claims_ownership": row[4],
                    "municipality_irrevocably_transferred": row[5],
                }

        # Build extra data dict
        extra_data = {
            "kennels": kennel_data,
            "intakes": intake_data,
        }

        return items, len(items), has_more, extra_data

    async def update_animal(
        self,
        organization_id: uuid.UUID,
        animal_id: uuid.UUID,
        data: AnimalUpdate,
        actor_id: uuid.UUID,
        ip: str | None = None,
        user_agent: str | None = None,
    ) -> Animal | None:
        animal = await self.get_animal(organization_id, animal_id)
        if animal is None:
            return None

        before = _animal_to_dict(animal)

        # PATCH semantics: only update fields that were sent
        update_data = data.model_dump(exclude_unset=True)

        # Handle breeds replacement
        breeds_data = update_data.pop("breeds", None)
        if breeds_data is not None:
            # Delete existing
            for ab in list(animal.animal_breeds):
                await self.db.delete(ab)
            await self.db.flush()
            # Insert new
            for entry in breeds_data:
                ab = AnimalBreed(
                    animal_id=animal.id,
                    breed_id=entry["breed_id"],
                    percent=entry.get("percent"),
                )
                self.db.add(ab)

        # Handle identifiers replacement
        identifiers_data = update_data.pop("identifiers", None)
        if identifiers_data is not None:
            # Delete existing
            for ident in list(animal.identifiers):
                await self.db.delete(ident)
            await self.db.flush()
            # Insert new
            for ident in identifiers_data:
                # Convert enum to string value if needed
                type_val = ident["type"]
                type_val = type_val.value if hasattr(type_val, "value") else type_val
                ai = AnimalIdentifier(
                    id=uuid.uuid4(),
                    organization_id=organization_id,
                    animal_id=animal.id,
                    type=type_val,
                    value=ident["value"],
                    registry=ident.get("registry"),
                    issued_at=ident.get("issued_at"),
                )
                self.db.add(ai)

        # Track status change before applying
        new_status = update_data.get("status")

        # Validate: pregnant/lactating not allowed for animals younger than 9 months
        if update_data.get("is_pregnant") or update_data.get("is_lactating"):
            bd = animal.birth_date_estimated or update_data.get("birth_date_estimated")
            if bd and (date.today() - bd).days < PREGNANCY_MIN_AGE_DAYS:
                raise HTTPException(
                    status_code=422,
                    detail="Animal is too young to be set as pregnant or lactating (must be at least 9 months old).",
                )

        # Update scalar fields
        for field, value in update_data.items():
            setattr(animal, field, value)

        # Recalculate MER when health flags or related fields change
        health_flag_fields = {
            "is_critical",
            "is_diabetic",
            "is_cancer",
            "is_pregnant",
            "is_lactating",
            "altered_status",
            "weight_current_kg",
        }
        if update_data.keys() & health_flag_fields and animal.weight_current_kg:
            rer = 70 * (float(animal.weight_current_kg) ** 0.75)
            if animal.species.value == "cat":
                activity_factor = 1.2
            elif animal.altered_status.value in ("intact",):
                activity_factor = 1.8
            else:
                activity_factor = 1.4
            animal.mer_kcal_per_day = int(rer * activity_factor)

        await self.db.flush()

        # Recompute default_image_url if species, breed, or color changed
        # Only if no real photo exists (primary_photo_url is null)
        if animal.primary_photo_url is None:
            needs_recompute = (
                "species" in update_data
                or "breeds" in update_data
                or "color" in update_data
            )
            if needs_recompute:
                breed_ids = (
                    [ab.breed_id for ab in animal.animal_breeds]
                    if animal.animal_breeds
                    else None
                )
                default_img = await self._compute_default_image_url(
                    species=(
                        animal.species.value
                        if hasattr(animal.species, "value")
                        else animal.species
                    ).lower(),
                    breed_ids=breed_ids,
                    color=animal.color,
                )
                animal.default_image_url = (
                    default_img.public_url if default_img else None
                )
                animal.default_thumbnail_url = (
                    default_img.thumbnail_url if default_img else None
                )
                await self.db.flush()

        after = _animal_to_dict(animal)

        # Auto-create disposal task when animal is marked deceased
        if new_status == "deceased":
            from src.app.models.task import Task, TaskType, TaskStatus, TaskPriority

            disposal_task = Task(
                id=uuid.uuid4(),
                organization_id=organization_id,
                created_by_id=actor_id,
                title=f"Likvidace těla – {animal.name} ({animal.public_code})",
                description=f"Zvíře {animal.name} bylo zaevidováno jako uhynulé. Zajistěte likvidaci těla v souladu s předpisy.",
                type=TaskType.GENERAL,
                priority=TaskPriority.HIGH,
                status=TaskStatus.PENDING,
                related_entity_type="animal",
                related_entity_id=animal.id,
            )
            self.db.add(disposal_task)
            await self.db.flush()

        # Log escape event when status changes to escaped
        if new_status == "escaped":
            await self.audit.log_action(
                organization_id=organization_id,
                actor_user_id=actor_id,
                action="escaped",
                entity_type="animal",
                entity_id=animal.id,
                after={"status": "escaped"},
                ip=ip,
                user_agent=user_agent,
            )

        # Log return event when status changes from escaped to something else
        old_status = before.get("status")
        if old_status == "escaped" and new_status and new_status != "escaped":
            # Special handling: If animal has active website deadline, force status back to waiting_adoption
            if animal.website_published_at and animal.website_deadline_at:
                if not animal.website_deadline_expired():
                    # Override user's choice - animal must stay in waiting_adoption
                    animal.status = "waiting_adoption"
                    new_status = "waiting_adoption"

                    # Log that we overrode the status
                    await self.audit.log_action(
                        organization_id=organization_id,
                        actor_user_id=actor_id,
                        action="auto_restore_waiting_adoption",
                        entity_type="animal",
                        entity_id=animal.id,
                        before={"intended_status": update_data.get("status")},
                        after={
                            "actual_status": "waiting_adoption",
                            "reason": "website_deadline_not_expired",
                        },
                        ip=ip,
                        user_agent=user_agent,
                    )

            await self.audit.log_action(
                organization_id=organization_id,
                actor_user_id=actor_id,
                action="returned",
                entity_type="animal",
                entity_id=animal.id,
                after={"status": new_status},
                ip=ip,
                user_agent=user_agent,
            )

        # Audit log
        await self.audit.log_action(
            organization_id=organization_id,
            actor_user_id=actor_id,
            action="update",
            entity_type="animal",
            entity_id=animal.id,
            before=before,
            after=after,
            ip=ip,
            user_agent=user_agent,
        )

        await self.db.refresh(animal)
        return animal

    async def delete_animal(
        self,
        organization_id: uuid.UUID,
        animal_id: uuid.UUID,
        actor_id: uuid.UUID,
        ip: str | None = None,
        user_agent: str | None = None,
    ) -> bool:
        animal = await self.get_animal(organization_id, animal_id)
        if animal is None:
            return False

        before = _animal_to_dict(animal)

        now = datetime.now(timezone.utc)

        active_stays = await self.db.execute(
            select(KennelStay).where(
                KennelStay.animal_id == animal_id,
                KennelStay.end_at.is_(None),
            )
        )
        for stay in active_stays.scalars().all():
            stay.end_at = now

        await self.db.flush()

        animal.deleted_at = now

        await self.audit.log_action(
            organization_id=organization_id,
            actor_user_id=actor_id,
            action="delete",
            entity_type="animal",
            entity_id=animal.id,
            before=before,
            ip=ip,
            user_agent=user_agent,
        )

        return True
