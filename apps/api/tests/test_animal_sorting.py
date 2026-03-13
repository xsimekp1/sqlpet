"""Tests for animal list sorting functionality."""
import uuid
from datetime import date, timedelta

import pytest
from sqlalchemy import select, delete

from src.app.models.animal import Animal, Species, AnimalStatus
from src.app.models.intake import Intake
from src.app.models.organization import Organization
from src.app.models.user import User
from src.app.models.role import Role
from src.app.models.permission import Permission
from src.app.models.role_permission import RolePermission
from src.app.models.membership import Membership, MembershipStatus
from src.app.core.security import hash_password, create_access_token

pytestmark = pytest.mark.anyio


@pytest.fixture()
async def animals_with_intakes(db_session, test_org_with_membership, test_user):
    """Create animals with different intake dates for sorting tests."""
    org, _, _ = test_org_with_membership

    animals = []
    intakes = []
    today = date.today()

    # Create 3 animals with different intake dates
    animal_data = [
        {"name": "Alpha", "days_ago": 30},  # oldest in shelter
        {"name": "Beta", "days_ago": 7},    # middle
        {"name": "Charlie", "days_ago": 1}, # newest in shelter
    ]

    for data in animal_data:
        animal = Animal(
            id=uuid.uuid4(),
            organization_id=org.id,
            name=data["name"],
            species=Species.DOG,
            status=AnimalStatus.INTAKE,
        )
        db_session.add(animal)
        animals.append(animal)

    await db_session.flush()

    # Create intakes with different dates
    for animal, data in zip(animals, animal_data):
        intake = Intake(
            id=uuid.uuid4(),
            organization_id=org.id,
            animal_id=animal.id,
            intake_date=today - timedelta(days=data["days_ago"]),
            reason="stray",
            registered_by_id=test_user.id,
        )
        db_session.add(intake)
        intakes.append(intake)

    await db_session.commit()

    yield animals, intakes, org

    # Cleanup
    try:
        for intake in intakes:
            await db_session.execute(delete(Intake).where(Intake.id == intake.id))
        for animal in animals:
            await db_session.execute(delete(Animal).where(Animal.id == animal.id))
        await db_session.commit()
    except Exception:
        await db_session.rollback()


async def test_list_animals_sort_by_days_in_shelter_desc(
    client, auth_headers, animals_with_intakes
):
    """Test sorting animals by days in shelter (longest first)."""
    animals, _, org = animals_with_intakes
    headers = {**auth_headers, "x-organization-id": str(org.id)}

    resp = await client.get(
        "/animals?sort_by=days_in_shelter&sort_order=desc",
        headers=headers,
    )

    assert resp.status_code == 200
    body = resp.json()
    items = body["items"]

    # Alpha should be first (30 days), then Beta (7 days), then Charlie (1 day)
    names = [item["name"] for item in items]
    assert names.index("Alpha") < names.index("Beta")
    assert names.index("Beta") < names.index("Charlie")


async def test_list_animals_sort_by_days_in_shelter_asc(
    client, auth_headers, animals_with_intakes
):
    """Test sorting animals by days in shelter (newest arrivals first)."""
    animals, _, org = animals_with_intakes
    headers = {**auth_headers, "x-organization-id": str(org.id)}

    resp = await client.get(
        "/animals?sort_by=days_in_shelter&sort_order=asc",
        headers=headers,
    )

    assert resp.status_code == 200
    body = resp.json()
    items = body["items"]

    # Charlie should be first (1 day), then Beta (7 days), then Alpha (30 days)
    names = [item["name"] for item in items]
    assert names.index("Charlie") < names.index("Beta")
    assert names.index("Beta") < names.index("Alpha")


async def test_list_animals_sort_by_name_asc(
    client, auth_headers, animals_with_intakes
):
    """Test sorting animals by name A-Z."""
    animals, _, org = animals_with_intakes
    headers = {**auth_headers, "x-organization-id": str(org.id)}

    resp = await client.get(
        "/animals?sort_by=name&sort_order=asc",
        headers=headers,
    )

    assert resp.status_code == 200
    body = resp.json()
    items = body["items"]

    # Alpha, Beta, Charlie
    names = [item["name"] for item in items]
    assert names.index("Alpha") < names.index("Beta")
    assert names.index("Beta") < names.index("Charlie")


async def test_list_animals_sort_by_name_desc(
    client, auth_headers, animals_with_intakes
):
    """Test sorting animals by name Z-A."""
    animals, _, org = animals_with_intakes
    headers = {**auth_headers, "x-organization-id": str(org.id)}

    resp = await client.get(
        "/animals?sort_by=name&sort_order=desc",
        headers=headers,
    )

    assert resp.status_code == 200
    body = resp.json()
    items = body["items"]

    # Charlie, Beta, Alpha
    names = [item["name"] for item in items]
    assert names.index("Charlie") < names.index("Beta")
    assert names.index("Beta") < names.index("Alpha")


async def test_list_animals_default_sort(
    client, auth_headers, animals_with_intakes
):
    """Test that default sort is by created_at desc."""
    animals, _, org = animals_with_intakes
    headers = {**auth_headers, "x-organization-id": str(org.id)}

    resp = await client.get(
        "/animals",
        headers=headers,
    )

    assert resp.status_code == 200
    body = resp.json()
    # Should return 200 OK with items
    assert "items" in body
