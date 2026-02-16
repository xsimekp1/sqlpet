import uuid
from datetime import date, datetime, timezone

from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from decimal import Decimal

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
        result = await self.db.execute(
            select(Animal).where(
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
    ) -> tuple[list[Animal], int, bool]:
        from sqlalchemy.orm import selectinload

        base = select(Animal).where(
            Animal.organization_id == organization_id,
            Animal.deleted_at.is_(None),
        )

        if species:
            base = base.where(Animal.species == species)
        if status:
            base = base.where(Animal.status == status)
        if sex:
            base = base.where(Animal.sex == sex)
        if search:
            base = base.where(Animal.name.ilike(f"%{search}%"))

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

        return items, len(items), has_more

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

        # Update scalar fields
        for field, value in update_data.items():
            setattr(animal, field, value)

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
