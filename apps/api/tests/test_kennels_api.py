"""
Tests for:
- GET /kennels  -- real occupied_count, animals_preview, status/type/size_category
- GET /kennels/{id}  -- real data from SQL JOIN
- GET /animals/{id}  -- current_kennel_* fields populated from active stay
- GET /animals       -- current_kennel_* fields in list response
- _calculate_alerts_from_data helper (pure unit tests)
"""
import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import delete, select, text

from src.app.models.animal import Animal, Species
from src.app.models.animal_breed import AnimalBreed
from src.app.models.animal_identifier import AnimalIdentifier
from src.app.models.kennel import Kennel, Zone
from src.app.models.organization import Organization
from src.app.models.role import Role
from src.app.models.permission import Permission
from src.app.models.role_permission import RolePermission
from src.app.models.membership import Membership, MembershipStatus
from src.app.core.security import create_access_token
from src.app.api.routes.kennels import _calculate_alerts_from_data


# ---------------------------------------------------------------------------
# Unit tests — pure synchronous logic, no DB, no anyio needed
# ---------------------------------------------------------------------------

@pytest.mark.anyio
class TestCalculateAlertsFromData:
    async def test_no_alerts_when_empty(self):
        assert _calculate_alerts_from_data("available", "indoor", 0, 4) == []

    async def test_no_alerts_when_partial(self):
        assert _calculate_alerts_from_data("available", "indoor", 2, 4) == []

    async def test_overcapacity_alert(self):
        alerts = _calculate_alerts_from_data("available", "indoor", 5, 4)
        assert "overcapacity" in alerts

    async def test_animals_in_maintenance_alert(self):
        alerts = _calculate_alerts_from_data("maintenance", "indoor", 1, 4)
        assert "animals_in_maintenance" in alerts

    async def test_no_maintenance_alert_when_empty(self):
        alerts = _calculate_alerts_from_data("maintenance", "indoor", 0, 4)
        assert "animals_in_maintenance" not in alerts

    async def test_quarantine_mix_alert_with_multiple(self):
        alerts = _calculate_alerts_from_data("available", "quarantine", 2, 4)
        assert "quarantine_mix" in alerts

    async def test_no_quarantine_mix_with_single(self):
        alerts = _calculate_alerts_from_data("available", "quarantine", 1, 4)
        assert "quarantine_mix" not in alerts

    async def test_multiple_alerts(self):
        alerts = _calculate_alerts_from_data("maintenance", "quarantine", 6, 4)
        assert "overcapacity" in alerts
        assert "animals_in_maintenance" in alerts
        assert "quarantine_mix" in alerts


# ---------------------------------------------------------------------------
# Integration fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
async def kennel_test_env(db_session, test_user):
    """Creates org + role (animals.read/write) + zone + kennel + animal + active stay."""
    org_id = uuid.uuid4()
    role_id = uuid.uuid4()
    zone_id = uuid.uuid4()
    kennel_id = uuid.uuid4()
    animal_id = uuid.uuid4()
    stay_id = uuid.uuid4()
    membership_id = uuid.uuid4()

    org = Organization(id=org_id, name="Kennel Test Org", slug=f"kennel-org-{org_id.hex[:8]}")
    db_session.add(org)
    await db_session.flush()

    role = Role(id=role_id, organization_id=org_id, name="kennel_test_role", is_template=False)
    db_session.add(role)
    await db_session.flush()

    for perm_key in ("animals.read", "animals.write"):
        perm_result = await db_session.execute(
            select(Permission).where(Permission.key == perm_key)
        )
        perm = perm_result.scalar_one_or_none()
        if perm:
            db_session.add(RolePermission(role_id=role_id, permission_id=perm.id, allowed=True))
    await db_session.flush()

    membership = Membership(
        id=membership_id, user_id=test_user.id, organization_id=org_id,
        role_id=role_id, status=MembershipStatus.ACTIVE,
    )
    db_session.add(membership)

    zone = Zone(id=zone_id, organization_id=org_id, name="Zone A", code="A")
    db_session.add(zone)
    await db_session.flush()

    kennel = Kennel(
        id=kennel_id, organization_id=org_id, zone_id=zone_id,
        name="Kennel 1", code="K1", capacity=3,
        status="available", type="indoor", size_category="medium",
    )
    db_session.add(kennel)
    await db_session.flush()

    animal = Animal(
        id=animal_id, organization_id=org_id, name="Hafik", species=Species.DOG,
    )
    db_session.add(animal)
    await db_session.flush()

    # Raw SQL insert: kennel_stays has no updated_at column in this migration
    await db_session.execute(
        text("""
            INSERT INTO kennel_stays (id, organization_id, kennel_id, animal_id, start_at)
            VALUES (:id, :org_id, :kennel_id, :animal_id, :start_at)
        """),
        {
            "id": str(stay_id), "org_id": str(org_id),
            "kennel_id": str(kennel_id), "animal_id": str(animal_id),
            "start_at": datetime.now(timezone.utc),
        },
    )
    await db_session.commit()

    headers = {
        "Authorization": f"Bearer {create_access_token({'sub': str(test_user.id)})}",
        "x-organization-id": str(org_id),
    }

    yield {
        "org": org, "zone": zone, "kennel": kennel, "animal": animal,
        "stay_id": stay_id, "headers": headers,
    }

    # Cleanup (raw SQL for stay to avoid ORM RETURNING issues)
    await db_session.execute(text("DELETE FROM kennel_stays WHERE id = :id"), {"id": str(stay_id)})
    await db_session.execute(delete(AnimalBreed).where(AnimalBreed.animal_id == animal_id))
    await db_session.execute(delete(AnimalIdentifier).where(AnimalIdentifier.animal_id == animal_id))
    await db_session.execute(delete(Animal).where(Animal.id == animal_id))
    await db_session.execute(delete(Kennel).where(Kennel.id == kennel_id))
    await db_session.execute(delete(Zone).where(Zone.id == zone_id))
    await db_session.execute(delete(RolePermission).where(RolePermission.role_id == role_id))
    await db_session.execute(delete(Membership).where(Membership.id == membership_id))
    await db_session.execute(delete(Role).where(Role.id == role_id))
    await db_session.execute(delete(Organization).where(Organization.id == org_id))
    await db_session.commit()


# ---------------------------------------------------------------------------
# GET /kennels — real SQL JOIN tests
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_list_kennels_returns_real_occupied_count(client, kennel_test_env):
    """GET /kennels must return occupied_count=1 for a kennel with one active stay."""
    env = kennel_test_env
    resp = await client.get("/kennels", headers=env["headers"])
    assert resp.status_code == 200
    kennel_data = next((k for k in resp.json() if k["id"] == str(env["kennel"].id)), None)
    assert kennel_data is not None, "Kennel not found in response"
    assert kennel_data["occupied_count"] == 1


@pytest.mark.anyio
async def test_list_kennels_returns_animals_preview(client, kennel_test_env):
    """GET /kennels must include animal name in animals_preview for active stays."""
    env = kennel_test_env
    resp = await client.get("/kennels", headers=env["headers"])
    assert resp.status_code == 200
    kennel_data = next((k for k in resp.json() if k["id"] == str(env["kennel"].id)), None)
    assert kennel_data is not None
    preview = kennel_data["animals_preview"]
    assert len(preview) == 1
    assert preview[0]["name"] == "Hafik"
    assert preview[0]["id"] == str(env["animal"].id)


@pytest.mark.anyio
async def test_list_kennels_returns_real_status_type_size(client, kennel_test_env):
    """GET /kennels must return actual status/type/size_category, not hardcoded values."""
    env = kennel_test_env
    resp = await client.get("/kennels", headers=env["headers"])
    assert resp.status_code == 200
    kennel_data = next((k for k in resp.json() if k["id"] == str(env["kennel"].id)), None)
    assert kennel_data is not None
    assert kennel_data["status"] == "available"
    assert kennel_data["type"] == "indoor"
    assert kennel_data["size_category"] == "medium"


@pytest.mark.anyio
async def test_list_kennels_returns_zone_name(client, kennel_test_env):
    """GET /kennels must JOIN zone and return zone_name."""
    env = kennel_test_env
    resp = await client.get("/kennels", headers=env["headers"])
    assert resp.status_code == 200
    kennel_data = next((k for k in resp.json() if k["id"] == str(env["kennel"].id)), None)
    assert kennel_data is not None
    assert kennel_data["zone_name"] == "Zone A"


@pytest.mark.anyio
async def test_list_kennels_filter_by_status(client, kennel_test_env):
    """GET /kennels?status=available returns kennel; status=maintenance does not."""
    env = kennel_test_env
    resp = await client.get("/kennels?status=available", headers=env["headers"])
    assert resp.status_code == 200
    assert any(k["id"] == str(env["kennel"].id) for k in resp.json())

    resp2 = await client.get("/kennels?status=maintenance", headers=env["headers"])
    assert resp2.status_code == 200
    assert not any(k["id"] == str(env["kennel"].id) for k in resp2.json())


@pytest.mark.anyio
async def test_list_kennels_filter_by_type(client, kennel_test_env):
    """GET /kennels?type=indoor returns; type=outdoor does not."""
    env = kennel_test_env
    resp = await client.get("/kennels?type=indoor", headers=env["headers"])
    assert resp.status_code == 200
    assert any(k["id"] == str(env["kennel"].id) for k in resp.json())

    resp2 = await client.get("/kennels?type=outdoor", headers=env["headers"])
    assert resp2.status_code == 200
    assert not any(k["id"] == str(env["kennel"].id) for k in resp2.json())


@pytest.mark.anyio
async def test_list_kennels_search(client, kennel_test_env):
    """GET /kennels?q=Kennel finds by name; q=nonexistent does not."""
    env = kennel_test_env
    resp = await client.get("/kennels?q=Kennel+1", headers=env["headers"])
    assert resp.status_code == 200
    assert any(k["id"] == str(env["kennel"].id) for k in resp.json())

    resp2 = await client.get("/kennels?q=DOESNOTEXIST_XYZ", headers=env["headers"])
    assert resp2.status_code == 200
    assert not any(k["id"] == str(env["kennel"].id) for k in resp2.json())


# ---------------------------------------------------------------------------
# GET /kennels/{id} — real data test
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_get_kennel_returns_real_data(client, kennel_test_env):
    """GET /kennels/{id} must return real status, zone_name, occupied_count, animals_preview."""
    env = kennel_test_env
    resp = await client.get(f"/kennels/{env['kennel'].id}", headers=env["headers"])
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == str(env["kennel"].id)
    assert data["status"] == "available"
    assert data["type"] == "indoor"
    assert data["zone_name"] == "Zone A"
    assert data["occupied_count"] == 1
    assert len(data["animals_preview"]) == 1
    assert data["animals_preview"][0]["name"] == "Hafik"


@pytest.mark.anyio
async def test_get_kennel_not_found(client, kennel_test_env):
    """GET /kennels/{unknown_id} should return 404."""
    env = kennel_test_env
    resp = await client.get(f"/kennels/{uuid.uuid4()}", headers=env["headers"])
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /animals/{id} — current_kennel_* fields
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_get_animal_has_current_kennel(client, kennel_test_env):
    """GET /animals/{id} must include current_kennel_id/name/code when animal has active stay."""
    env = kennel_test_env
    resp = await client.get(f"/animals/{env['animal'].id}", headers=env["headers"])
    assert resp.status_code == 200
    data = resp.json()
    assert data["current_kennel_id"] == str(env["kennel"].id)
    assert data["current_kennel_name"] == "Kennel 1"
    assert data["current_kennel_code"] == "K1"


@pytest.mark.anyio
async def test_get_animal_no_kennel_fields_null(client, kennel_test_env, db_session):
    """Animal without a stay should have current_kennel_* = null."""
    env = kennel_test_env
    animal_id = uuid.uuid4()
    animal = Animal(id=animal_id, organization_id=env["org"].id, name="Unhoused", species=Species.CAT)
    db_session.add(animal)
    await db_session.commit()

    try:
        resp = await client.get(f"/animals/{animal_id}", headers=env["headers"])
        assert resp.status_code == 200
        data = resp.json()
        assert data["current_kennel_id"] is None
        assert data["current_kennel_name"] is None
        assert data["current_kennel_code"] is None
    finally:
        await db_session.execute(delete(Animal).where(Animal.id == animal_id))
        await db_session.commit()


# ---------------------------------------------------------------------------
# GET /animals list — current_kennel_* in list response
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_list_animals_includes_current_kennel(client, kennel_test_env):
    """GET /animals list must include current_kennel_* for each animal."""
    env = kennel_test_env
    resp = await client.get("/animals", headers=env["headers"])
    assert resp.status_code == 200
    data = resp.json()
    animal_data = next((a for a in data["items"] if a["id"] == str(env["animal"].id)), None)
    assert animal_data is not None
    assert animal_data["current_kennel_id"] == str(env["kennel"].id)
    assert animal_data["current_kennel_code"] == "K1"


# ---------------------------------------------------------------------------
# GET /animals/{id}/kennel-history
# ---------------------------------------------------------------------------

@pytest.mark.anyio
async def test_get_animal_kennel_history_returns_stay(client, kennel_test_env):
    """GET /animals/{id}/kennel-history returns kennel_code and assigned_at for active stay."""
    env = kennel_test_env
    resp = await client.get(f"/animals/{env['animal'].id}/kennel-history", headers=env["headers"])
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    entry = data[0]
    assert entry["kennel_code"] == "K1"
    assert entry["assigned_at"] is not None


@pytest.mark.anyio
async def test_get_animal_kennel_history_unknown_animal_returns_404(client, kennel_test_env):
    """GET /animals/{unknown_id}/kennel-history should return 404."""
    env = kennel_test_env
    resp = await client.get(f"/animals/{uuid.uuid4()}/kennel-history", headers=env["headers"])
    assert resp.status_code == 404
