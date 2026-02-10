import uuid

import pytest
from sqlalchemy import select, delete

from src.app.models.organization import Organization
from src.app.models.animal import Animal, Species, Sex, AnimalStatus

pytestmark = pytest.mark.anyio


async def test_create_animal(db_session):
    org_id = uuid.uuid4()
    animal_id = uuid.uuid4()

    try:
        # 1. Create Organization
        org = Organization(
            id=org_id,
            name="Test Shelter",
            slug=f"test-shelter-{org_id.hex[:8]}",
            timezone="Europe/Prague",
        )
        db_session.add(org)
        await db_session.flush()

        # 2. Create Animal
        animal = Animal(
            id=animal_id,
            organization_id=org_id,
            name="Rex",
            species=Species.DOG,
            sex=Sex.MALE,
            status=AnimalStatus.INTAKE,
        )
        db_session.add(animal)
        await db_session.commit()

        # 3. Verify — SELECT it back
        result = await db_session.execute(
            select(Animal).where(Animal.id == animal_id)
        )
        fetched = result.scalar_one()

        assert fetched.name == "Rex"
        assert fetched.species == Species.DOG
        assert fetched.sex == Sex.MALE
        assert fetched.status == AnimalStatus.INTAKE
        assert fetched.organization_id == org_id
        assert fetched.created_at is not None

    finally:
        # 4. Cleanup — delete test records
        await db_session.execute(delete(Animal).where(Animal.id == animal_id))
        await db_session.execute(delete(Organization).where(Organization.id == org_id))
        await db_session.commit()
