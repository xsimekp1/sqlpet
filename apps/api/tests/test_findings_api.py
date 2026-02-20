"""Tests for Findings API."""

import uuid
from datetime import datetime, timedelta, date

import pytest
from httpx import AsyncClient
from sqlalchemy import delete, select

from src.app.core.security import create_access_token
from src.app.models.animal import Animal
from src.app.models.contact import Contact
from src.app.models.finding import Finding
from src.app.models.organization import Organization
from src.app.models.role import Role
from src.app.models.permission import Permission
from src.app.models.role_permission import RolePermission
from src.app.models.membership import Membership, MembershipStatus


@pytest.fixture()
async def findings_env(db_session, test_user):
    """Creates org + role + membership + contact + animal for findings tests."""
    org_id = uuid.uuid4()
    role_id = uuid.uuid4()
    membership_id = uuid.uuid4()
    contact_id = uuid.uuid4()
    animal_id = uuid.uuid4()

    org = Organization(
        id=org_id, name="Findings Test Org", slug=f"findings-org-{org_id.hex[:8]}"
    )
    db_session.add(org)
    await db_session.flush()

    role = Role(
        id=role_id, organization_id=org_id, name="findings_test_role", is_template=False
    )
    db_session.add(role)
    await db_session.flush()

    for perm_key in (
        "animals.read",
        "animals.write",
        "intake.read",
        "intake.write",
        "people.read",
        "reports.run",
    ):
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

    contact = Contact(
        id=contact_id,
        organization_id=org_id,
        name="Test Finder",
        type="volunteer",
    )
    db_session.add(contact)
    await db_session.flush()

    animal = Animal(
        id=animal_id,
        organization_id=org_id,
        public_code=f"FND-{animal_id.hex[:6]}",
        name="Test Animal",
        species="dog",
        sex="male",
        altered_status="intact",
        status="intake",
    )
    db_session.add(animal)
    await db_session.flush()

    await db_session.commit()

    return {
        "org_id": org_id,
        "role_id": role_id,
        "contact_id": contact_id,
        "animal_id": animal_id,
        "user_id": test_user.id,
    }


@pytest.fixture()
async def findings_with_data(db_session, findings_env):
    """Creates multiple findings for testing filters."""
    org_id = findings_env["org_id"]
    contact_id = findings_env["contact_id"]
    animal_id = findings_env["animal_id"]

    now = datetime.utcnow()

    findings = [
        Finding(
            id=uuid.uuid4(),
            organization_id=org_id,
            who_found_id=contact_id,
            where_lat=50.0755,
            where_lng=14.4378,
            when_found=now - timedelta(days=5),
            notes="Found near center",
            animal_id=animal_id,
        ),
        Finding(
            id=uuid.uuid4(),
            organization_id=org_id,
            who_found_id=contact_id,
            where_lat=50.1,
            where_lng=14.5,
            when_found=now - timedelta(days=15),
            notes="Found in suburb",
            animal_id=animal_id,
        ),
        Finding(
            id=uuid.uuid4(),
            organization_id=org_id,
            who_found_id=None,
            where_lat=None,
            where_lng=None,
            when_found=now - timedelta(days=30),
            notes="Found without GPS",
            animal_id=None,
        ),
    ]

    for f in findings:
        db_session.add(f)
    await db_session.commit()

    return {
        "org_id": org_id,
        "contact_id": contact_id,
        "animal_id": animal_id,
        "findings": findings,
        "user_id": findings_env["user_id"],
    }


def get_auth_headers(user_id: uuid.UUID, org_id: uuid.UUID) -> dict:
    token = create_access_token({"sub": str(user_id), "org_id": str(org_id)})
    return {
        "Authorization": f"Bearer {token}",
        "X-Organization-Id": str(org_id),
    }


class TestFindingsAPI:
    async def test_create_finding(self, client: AsyncClient, findings_env):
        """Test creating a new finding."""
        org_id = findings_env["org_id"]
        user_id = findings_env["user_id"]
        animal_id = findings_env["animal_id"]
        contact_id = findings_env["contact_id"]

        payload = {
            "who_found_id": str(contact_id),
            "where_lat": 50.0755,
            "where_lng": 14.4378,
            "when_found": datetime.utcnow().isoformat(),
            "notes": "Test finding",
            "animal_id": str(animal_id),
        }

        response = await client.post(
            "/findings",
            json=payload,
            headers=get_auth_headers(user_id, org_id),
        )

        assert response.status_code == 201
        data = response.json()
        assert data["who_found_id"] == str(contact_id)
        assert data["where_lat"] == 50.0755
        assert data["where_lng"] == 14.4378
        assert data["notes"] == "Test finding"
        assert data["animal_id"] == str(animal_id)

    async def test_list_findings(self, client: AsyncClient, findings_with_data):
        """Test listing all findings."""
        org_id = findings_with_data["org_id"]
        user_id = findings_with_data["user_id"]

        response = await client.get(
            "/findings",
            headers=get_auth_headers(user_id, org_id),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 3
        assert len(data["items"]) == 3

    async def test_list_findings_with_date_filter(
        self, client: AsyncClient, findings_with_data
    ):
        """Test filtering findings by date range."""
        org_id = findings_with_data["org_id"]
        user_id = findings_with_data["user_id"]

        from datetime import date

        today = date.today()
        ten_days_ago = (today - timedelta(days=10)).isoformat()
        today_str = today.isoformat()

        response = await client.get(
            f"/findings?date_from={ten_days_ago}&date_to={today_str}",
            headers=get_auth_headers(user_id, org_id),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1

    async def test_list_findings_with_animal_filter(
        self, client: AsyncClient, findings_with_data
    ):
        """Test filtering findings by animal_id."""
        org_id = findings_with_data["org_id"]
        animal_id = findings_with_data["animal_id"]
        user_id = findings_with_data["user_id"]

        response = await client.get(
            f"/findings?animal_id={animal_id}",
            headers=get_auth_headers(user_id, org_id),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2

    async def test_list_findings_with_contact_filter(
        self, client: AsyncClient, findings_with_data
    ):
        """Test filtering findings by who_found_id."""
        org_id = findings_with_data["org_id"]
        contact_id = findings_with_data["contact_id"]
        user_id = findings_with_data["user_id"]

        response = await client.get(
            f"/findings?who_found_id={contact_id}",
            headers=get_auth_headers(user_id, org_id),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2

    async def test_get_finding_by_id(self, client: AsyncClient, findings_with_data):
        """Test getting a single finding by ID."""
        org_id = findings_with_data["org_id"]
        finding_id = findings_with_data["findings"][0].id
        user_id = findings_with_data["user_id"]

        response = await client.get(
            f"/findings/{finding_id}",
            headers=get_auth_headers(user_id, org_id),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(finding_id)

    async def test_update_finding(self, client: AsyncClient, findings_with_data):
        """Test updating a finding."""
        org_id = findings_with_data["org_id"]
        finding_id = findings_with_data["findings"][0].id
        user_id = findings_with_data["user_id"]

        payload = {
            "notes": "Updated notes",
        }

        response = await client.patch(
            f"/findings/{finding_id}",
            json=payload,
            headers=get_auth_headers(user_id, org_id),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["notes"] == "Updated notes"

    async def test_delete_finding(self, client: AsyncClient, findings_with_data):
        """Test deleting a finding."""
        org_id = findings_with_data["org_id"]
        finding_id = findings_with_data["findings"][0].id
        user_id = findings_with_data["user_id"]

        response = await client.delete(
            f"/findings/{finding_id}",
            headers=get_auth_headers(user_id, org_id),
        )

        assert response.status_code == 204

        response = await client.get(
            f"/findings/{finding_id}",
            headers=get_auth_headers(user_id, org_id),
        )
        assert response.status_code == 404

    async def test_get_contact_findings(self, client: AsyncClient, findings_with_data):
        """Test getting findings for a specific contact."""
        org_id = findings_with_data["org_id"]
        contact_id = findings_with_data["contact_id"]
        user_id = findings_with_data["user_id"]

        response = await client.get(
            f"/findings/contact/{contact_id}/findings",
            headers=get_auth_headers(user_id, org_id),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2

    async def test_pagination(self, client: AsyncClient, findings_with_data):
        """Test pagination of findings."""
        org_id = findings_with_data["org_id"]
        user_id = findings_with_data["user_id"]

        response = await client.get(
            "/findings?page=1&page_size=2",
            headers=get_auth_headers(user_id, org_id),
        )

        assert response.status_code == 200
        data = response.json()
        assert data["page"] == 1
        assert data["page_size"] == 2
        assert data["total"] == 3
        assert len(data["items"]) == 2

    async def test_map_data_returns_organization_coords(
        self, client: AsyncClient, findings_with_data
    ):
        """Test /findings/map-data returns organization coordinates."""
        org_id = findings_with_data["org_id"]
        user_id = findings_with_data["user_id"]

        response = await client.get(
            "/findings/map-data",
            headers=get_auth_headers(user_id, org_id),
        )

        assert response.status_code == 200
        data = response.json()
        assert "organization" in data
        assert "findings" in data
        assert isinstance(data["findings"], list)

    async def test_map_data_returns_findings_with_gps(
        self, client: AsyncClient, findings_with_data
    ):
        """Test /findings/map-data returns only findings with GPS coordinates."""
        org_id = findings_with_data["org_id"]
        user_id = findings_with_data["user_id"]

        response = await client.get(
            "/findings/map-data",
            headers=get_auth_headers(user_id, org_id),
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["findings"]) == 2  # Only 2 findings have GPS

    async def test_map_data_without_auth_returns_401(
        self, client: AsyncClient, findings_with_data
    ):
        """Test /findings/map-data returns 401 without auth."""
        org_id = findings_with_data["org_id"]

        response = await client.get(
            "/findings/map-data",
            headers={"X-Organization-Id": str(org_id)},
        )

        assert response.status_code == 401
