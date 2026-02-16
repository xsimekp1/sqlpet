"""Tests for Hotel intake functionality."""

import uuid

import pytest
from sqlalchemy import delete, select

from src.app.core.security import create_access_token
from src.app.models.animal import Animal
from src.app.models.intake import Intake, IntakeReason
from src.app.models.organization import Organization
from src.app.models.role import Role
from src.app.models.permission import Permission
from src.app.models.role_permission import RolePermission
from src.app.models.membership import Membership, MembershipStatus


@pytest.fixture()
async def intake_env(db_session, test_user):
    """Creates org + role + membership + animal for intake tests."""
    org_id = uuid.uuid4()
    role_id = uuid.uuid4()
    membership_id = uuid.uuid4()
    animal_id = uuid.uuid4()

    org = Organization(
        id=org_id, name="Intake Test Org", slug=f"intake-org-{org_id.hex[:8]}"
    )
    db_session.add(org)
    await db_session.flush()

    role = Role(
        id=role_id, organization_id=org_id, name="intake_test_role", is_template=False
    )
    db_session.add(role)
    await db_session.flush()

    for perm_key in ("animals.read", "animals.write", "intakes.read", "intakes.write"):
        perm_result = await db_session.execute(
            select(Permission).where(Permission.key == perm_key)
        )
        perm = perm_result.scalar_one_or_none()
        if perm:
            db_session.add(
                RolePermission(role_id=role_id, permission_id=perm.id, allowed=True)
            )
    await db_session.flush()

    membership = Membership(
        id=membership_id,
        user_id=test_user.id,
        organization_id=org_id,
        role_id=role_id,
        status=MembershipStatus.ACTIVE,
    )
    db_session.add(membership)
    await db_session.flush()

    animal = Animal(
        id=animal_id,
        organization_id=org_id,
        name="Test Dog",
        species="dog",
        sex="male",
        status="available",
    )
    db_session.add(animal)
    await db_session.commit()

    token = create_access_token({"sub": str(test_user.id), "org_id": str(org_id)})
    headers = {
        "Authorization": f"Bearer {token}",
        "x-organization-id": str(org_id),
    }

    yield {"org": org, "animal": animal, "headers": headers, "org_id": org_id}

    await db_session.execute(delete(Intake).where(Intake.organization_id == org_id))
    await db_session.execute(delete(Animal).where(Animal.id == animal_id))
    await db_session.execute(delete(Membership).where(Membership.id == membership_id))
    await db_session.execute(delete(Role).where(Role.id == role_id))
    await db_session.execute(delete(Organization).where(Organization.id == org_id))
    await db_session.commit()


@pytest.mark.anyio
async def test_create_hotel_intake_with_valid_end_date(client, intake_env):
    """Test successful hotel intake creation with valid end date."""
    resp = await client.post(
        "/intakes",
        json={
            "animal_id": str(intake_env["animal"].id),
            "reason": "hotel",
            "intake_date": "2024-06-01",
            "planned_end_date": "2024-06-15",
        },
        headers=intake_env["headers"],
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["reason"] == "hotel"
    assert data["planned_end_date"] == "2024-06-15"


@pytest.mark.anyio
async def test_create_hotel_intake_without_end_date(client, intake_env):
    """Test that hotel intake without planned_end_date fails."""
    resp = await client.post(
        "/intakes",
        json={
            "animal_id": str(intake_env["animal"].id),
            "reason": "hotel",
            "intake_date": "2024-06-01",
        },
        headers=intake_env["headers"],
    )
    assert resp.status_code == 422
    errors = resp.json()["detail"]
    assert any("planned_end_date" in str(e.get("msg", "")) for e in errors)


@pytest.mark.anyio
async def test_create_hotel_intake_end_date_before_intake(client, intake_env):
    """Test that hotel intake with end_date before intake_date fails."""
    resp = await client.post(
        "/intakes",
        json={
            "animal_id": str(intake_env["animal"].id),
            "reason": "hotel",
            "intake_date": "2024-06-15",
            "planned_end_date": "2024-06-01",
        },
        headers=intake_env["headers"],
    )
    assert resp.status_code == 422
    errors = resp.json()["detail"]
    assert any("planned_end_date" in str(e.get("msg", "")) for e in errors)


@pytest.mark.anyio
async def test_create_intake_without_end_date_still_works(client, intake_env):
    """Test that non-hotel intake without planned_end_date still works."""
    resp = await client.post(
        "/intakes",
        json={
            "animal_id": str(intake_env["animal"].id),
            "reason": "found",
            "intake_date": "2024-06-01",
        },
        headers=intake_env["headers"],
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["reason"] == "found"
    assert data["planned_end_date"] is None


@pytest.mark.anyio
async def test_list_intakes_includes_hotel(client, intake_env):
    """Test that list includes hotel intake."""
    await client.post(
        "/intakes",
        json={
            "animal_id": str(intake_env["animal"].id),
            "reason": "hotel",
            "intake_date": "2024-06-01",
            "planned_end_date": "2024-06-15",
        },
        headers=intake_env["headers"],
    )

    resp = await client.get("/intakes", headers=intake_env["headers"])
    assert resp.status_code == 200
    data = resp.json()
    assert any(i["reason"] == "hotel" for i in data)


@pytest.mark.anyio
async def test_close_hotel_intake_with_hotel_end(client, intake_env):
    """Test closing hotel intake with hotel_end outcome."""
    create_resp = await client.post(
        "/intakes",
        json={
            "animal_id": str(intake_env["animal"].id),
            "reason": "hotel",
            "intake_date": "2024-06-01",
            "planned_end_date": "2024-06-15",
        },
        headers=intake_env["headers"],
    )
    assert create_resp.status_code == 201
    intake_id = create_resp.json()["id"]

    resp = await client.post(
        f"/intakes/{intake_id}/close",
        json={"outcome": "hotel_end"},
        headers=intake_env["headers"],
    )
    assert resp.status_code == 200


@pytest.mark.anyio
async def test_update_hotel_without_end_date_fails(client, intake_env):
    """Test updating non-hotel intake to hotel without end_date fails."""
    create_resp = await client.post(
        "/intakes",
        json={
            "animal_id": str(intake_env["animal"].id),
            "reason": "found",
            "intake_date": "2024-06-01",
        },
        headers=intake_env["headers"],
    )
    assert create_resp.status_code == 201
    intake_id = create_resp.json()["id"]

    resp = await client.put(
        f"/intakes/{intake_id}",
        json={"reason": "hotel"},
        headers=intake_env["headers"],
    )
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_update_hotel_with_valid_end_date(client, intake_env):
    """Test updating intake to hotel with valid end date."""
    create_resp = await client.post(
        "/intakes",
        json={
            "animal_id": str(intake_env["animal"].id),
            "reason": "found",
            "intake_date": "2024-06-01",
        },
        headers=intake_env["headers"],
    )
    assert create_resp.status_code == 201
    intake_id = create_resp.json()["id"]

    resp = await client.put(
        f"/intakes/{intake_id}",
        json={
            "reason": "hotel",
            "planned_end_date": "2024-06-20",
        },
        headers=intake_env["headers"],
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["reason"] == "hotel"
    assert data["planned_end_date"] == "2024-06-20"


@pytest.mark.anyio
async def test_hotel_intake_sets_animal_status_to_hotel(client, intake_env):
    """Test that creating hotel intake sets animal status to 'hotel'."""
    resp = await client.post(
        "/intakes",
        json={
            "animal_id": str(intake_env["animal"].id),
            "reason": "hotel",
            "intake_date": "2024-06-01",
            "planned_end_date": "2024-06-15",
        },
        headers=intake_env["headers"],
    )
    assert resp.status_code == 201

    # Check animal status is now "hotel"
    animal_resp = await client.get(
        f"/animals/{intake_env['animal'].id}",
        headers=intake_env["headers"],
    )
    assert animal_resp.status_code == 200
    animal_data = animal_resp.json()
    assert animal_data["status"] == "hotel"


@pytest.mark.anyio
async def test_regular_intake_sets_animal_status_to_intake(client, intake_env):
    """Test that creating regular intake sets animal status to 'intake'."""
    resp = await client.post(
        "/intakes",
        json={
            "animal_id": str(intake_env["animal"].id),
            "reason": "found",
            "intake_date": "2024-06-01",
        },
        headers=intake_env["headers"],
    )
    assert resp.status_code == 201

    # Check animal status is now "intake"
    animal_resp = await client.get(
        f"/animals/{intake_env['animal'].id}",
        headers=intake_env["headers"],
    )
    assert animal_resp.status_code == 200
    animal_data = animal_resp.json()
    assert animal_data["status"] == "intake"


@pytest.mark.anyio
async def test_hotel_end_sets_animal_status_to_with_owner(client, intake_env):
    """Test that closing hotel with hotel_end sets animal status to 'with_owner'."""
    create_resp = await client.post(
        "/intakes",
        json={
            "animal_id": str(intake_env["animal"].id),
            "reason": "hotel",
            "intake_date": "2024-06-01",
            "planned_end_date": "2024-06-15",
        },
        headers=intake_env["headers"],
    )
    assert create_resp.status_code == 201
    intake_id = create_resp.json()["id"]

    close_resp = await client.post(
        f"/intakes/{intake_id}/close",
        json={"outcome": "hotel_end"},
        headers=intake_env["headers"],
    )
    assert close_resp.status_code == 200

    # Check animal status is now "with_owner"
    animal_resp = await client.get(
        f"/animals/{intake_env['animal'].id}",
        headers=intake_env["headers"],
    )
    assert animal_resp.status_code == 200
    animal_data = animal_resp.json()
    assert animal_data["status"] == "with_owner"
