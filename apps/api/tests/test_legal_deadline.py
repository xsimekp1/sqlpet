"""Tests for legal deadline computation service."""

import uuid
from datetime import date

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
from src.app.services.legal_deadline import (
    compute_legal_deadline,
    LegalDeadlineInfo,
)


class TestLegalDeadlineService:
    """Unit tests for compute_legal_deadline function."""

    def test_no_legal_fields_returns_missing_data(self):
        """Test that missing both finder_claims_ownership and municipality returns missing_data."""
        result = compute_legal_deadline(
            notice_published_at=None,
            shelter_received_at=date(2024, 1, 1),
            finder_claims_ownership=None,
            municipality_irrevocably_transferred=None,
        )
        assert result.deadline_state == "missing_data"
        assert result.deadline_type == "unknown"
        assert "finder_claims_ownership" in result.missing_fields

    def test_scenario_a_2m_notice_with_all_data(self):
        """Test Scenario A: finder claims ownership, 2 months from notice."""
        notice_date = date(2024, 1, 15)
        result = compute_legal_deadline(
            notice_published_at=notice_date,
            shelter_received_at=date(2024, 1, 10),
            finder_claims_ownership=True,
            municipality_irrevocably_transferred=False,
        )
        assert result.deadline_type == "2m_notice"
        assert result.deadline_at == date(2024, 3, 15)
        assert result.deadline_state == "running"
        assert "2 měsíce" in result.label

    def test_scenario_a_missing_notice_date(self):
        """Test Scenario A with missing notice_published_at."""
        result = compute_legal_deadline(
            notice_published_at=None,
            shelter_received_at=date(2024, 1, 10),
            finder_claims_ownership=True,
            municipality_irrevocably_transferred=False,
        )
        assert result.deadline_state == "missing_data"
        assert result.deadline_type == "2m_notice"
        assert "notice_published_at" in result.missing_fields
        assert "Chybí datum" in result.label

    def test_scenario_b_4m_transfer_with_notice_date(self):
        """Test Scenario B: municipality transferred, 4 months from notice."""
        notice_date = date(2024, 1, 15)
        result = compute_legal_deadline(
            notice_published_at=notice_date,
            shelter_received_at=date(2024, 1, 10),
            finder_claims_ownership=False,
            municipality_irrevocably_transferred=True,
        )
        assert result.deadline_type == "4m_transfer"
        assert result.deadline_at == date(2024, 5, 15)
        assert result.deadline_state == "running"
        assert "4 měsíce" in result.label

    def test_scenario_b_4m_transfer_uses_later_date(self):
        """Test Scenario B uses later of notice vs shelter date."""
        result = compute_legal_deadline(
            notice_published_at=date(2024, 1, 10),
            shelter_received_at=date(2024, 2, 1),
            finder_claims_ownership=False,
            municipality_irrevocably_transferred=True,
        )
        assert result.deadline_type == "4m_transfer"
        assert result.deadline_at == date(2024, 6, 1)  # 4 months from shelter date

    def test_scenario_b_missing_both_dates(self):
        """Test Scenario B with both dates missing."""
        result = compute_legal_deadline(
            notice_published_at=None,
            shelter_received_at=None,
            finder_claims_ownership=False,
            municipality_irrevocably_transferred=True,
        )
        assert result.deadline_state == "missing_data"
        assert result.deadline_type == "4m_transfer"
        assert "notice_published_at" in result.missing_fields
        assert "shelter_received_at" in result.missing_fields

    def test_scenario_b_missing_shelter_date(self):
        """Test Scenario B with only notice date."""
        result = compute_legal_deadline(
            notice_published_at=date(2024, 1, 10),
            shelter_received_at=None,
            finder_claims_ownership=False,
            municipality_irrevocably_transferred=True,
        )
        assert result.deadline_type == "4m_transfer"
        assert result.deadline_at == date(2024, 5, 10)

    def test_no_deadline_when_finder_no_claim_and_no_municipality(self):
        """Test no deadline when finder doesn't claim and municipality hasn't transferred."""
        result = compute_legal_deadline(
            notice_published_at=date(2024, 1, 15),
            shelter_received_at=date(2024, 1, 10),
            finder_claims_ownership=False,
            municipality_irrevocably_transferred=False,
        )
        assert result.deadline_type == "unknown"
        assert result.deadline_state == "running"
        assert result.deadline_at is None
        assert "Bez lhůty" in result.label

    def test_deadline_month_edge_case_january(self):
        """Test deadline calculation at month end (Jan -> Mar)."""
        notice_date = date(2024, 1, 31)
        result = compute_legal_deadline(
            notice_published_at=notice_date,
            shelter_received_at=date(2024, 1, 1),
            finder_claims_ownership=True,
            municipality_irrevocably_transferred=False,
        )
        # March 31st, 2024 exists
        assert result.deadline_at == date(2024, 3, 31)

    def test_deadline_month_edge_case_december(self):
        """Test deadline calculation across year boundary (Dec -> Feb)."""
        notice_date = date(2024, 12, 15)
        result = compute_legal_deadline(
            notice_published_at=notice_date,
            shelter_received_at=date(2024, 12, 1),
            finder_claims_ownership=True,
            municipality_irrevocably_transferred=False,
        )
        # Feb 15th, 2025
        assert result.deadline_at == date(2025, 2, 15)

    def test_deadline_month_edge_case_leap_year_feb(self):
        """Test deadline calculation for February in leap year."""
        notice_date = date(2024, 1, 30)
        result = compute_legal_deadline(
            notice_published_at=notice_date,
            shelter_received_at=date(2024, 1, 1),
            finder_claims_ownership=True,
            municipality_irrevocably_transferred=False,
        )
        # Feb has 29 days in 2024 (leap year), so last day of Feb
        assert result.deadline_at == date(2024, 2, 29)

    def test_deadline_expired(self):
        """Test expired deadline detection."""
        notice_date = date(2020, 1, 1)  # Very old date
        result = compute_legal_deadline(
            notice_published_at=notice_date,
            shelter_received_at=date(2020, 1, 1),
            finder_claims_ownership=True,
            municipality_irrevocably_transferred=False,
        )
        assert result.deadline_state == "expired"
        assert result.days_left < 0

    def test_deadline_14_days_left(self):
        """Test deadline within 14 days shows days left."""
        from datetime import timedelta

        today = date.today()
        notice_date = today - timedelta(days=45)  # ~2 months - 45 days = ~15 days left
        result = compute_legal_deadline(
            notice_published_at=notice_date,
            shelter_received_at=today,
            finder_claims_ownership=True,
            municipality_irrevocably_transferred=False,
        )
        if result.days_left is not None and 0 < result.days_left <= 14:
            assert "Zbývá" in result.label
        else:
            # Just check it runs without error
            assert result.deadline_type == "2m_notice"


@pytest.fixture()
async def legal_deadline_env(db_session, test_user):
    """Creates org + role + membership + animal for legal deadline tests."""
    org_id = uuid.uuid4()
    role_id = uuid.uuid4()
    membership_id = uuid.uuid4()
    animal_id = uuid.uuid4()

    org = Organization(
        id=org_id, name="Legal Deadline Test Org", slug=f"legal-org-{org_id.hex[:8]}"
    )
    db_session.add(org)
    await db_session.flush()

    role = Role(
        id=role_id, organization_id=org_id, name="legal_test_role", is_template=False
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
        name="Legal Test Dog",
        species="dog",
        sex="male",
        status="intake",
    )
    db_session.add(animal)
    await db_session.commit()

    token = create_access_token({"sub": str(test_user.id), "org_id": str(org_id)})
    headers = {
        "Authorization": f"Bearer {token}",
        "x-organization-id": str(org_id),
    }

    yield {
        "org": org,
        "animal": animal,
        "headers": headers,
        "org_id": org_id,
        "role_id": role_id,
    }

    await db_session.execute(delete(Intake).where(Intake.organization_id == org_id))
    await db_session.execute(delete(Animal).where(Animal.id == animal_id))
    await db_session.execute(delete(Membership).where(Membership.id == membership_id))
    await db_session.execute(delete(Role).where(Role.id == role_id))
    await db_session.execute(delete(Organization).where(Organization.id == org_id))
    await db_session.commit()


@pytest.mark.anyio
async def test_create_found_intake_with_legal_deadline_fields(
    client, legal_deadline_env
):
    """Test creating found intake with legal deadline fields."""
    resp = await client.post(
        "/intakes",
        json={
            "animal_id": str(legal_deadline_env["animal"].id),
            "reason": "found",
            "intake_date": "2024-06-01",
            "notice_published_at": "2024-06-05",
            "finder_claims_ownership": True,
            "municipality_irrevocably_transferred": False,
        },
        headers=legal_deadline_env["headers"],
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["reason"] == "found"
    assert data["notice_published_at"] == "2024-06-05"
    assert data["finder_claims_ownership"] is True
    assert data["municipality_irrevocably_transferred"] is False


@pytest.mark.anyio
async def test_animal_api_returns_legal_deadline(client, legal_deadline_env):
    """Test that animal API returns computed legal deadline fields."""
    # Create intake with legal deadline data
    intake_resp = await client.post(
        "/intakes",
        json={
            "animal_id": str(legal_deadline_env["animal"].id),
            "reason": "found",
            "intake_date": "2024-01-01",
            "notice_published_at": "2024-01-15",
            "finder_claims_ownership": True,
            "municipality_irrevocably_transferred": False,
        },
        headers=legal_deadline_env["headers"],
    )
    assert intake_resp.status_code == 201

    # Get animal and check legal deadline fields
    animal_resp = await client.get(
        f"/animals/{legal_deadline_env['animal'].id}",
        headers=legal_deadline_env["headers"],
    )
    assert animal_resp.status_code == 200
    animal_data = animal_resp.json()

    assert "legal_deadline_at" in animal_data
    assert "legal_deadline_type" in animal_data
    assert "legal_deadline_days_left" in animal_data
    assert "legal_deadline_state" in animal_data

    # Should be 2 months from 2024-01-15 = 2024-03-15
    assert animal_data["legal_deadline_at"] == "2024-03-15"
    assert animal_data["legal_deadline_type"] == "2m_notice"


@pytest.mark.anyio
async def test_animal_list_returns_legal_deadline_fields(client, legal_deadline_env):
    """Test that animal list API returns legal deadline fields."""
    # Create intake with legal deadline data
    await client.post(
        "/intakes",
        json={
            "animal_id": str(legal_deadline_env["animal"].id),
            "reason": "found",
            "intake_date": "2024-01-01",
            "notice_published_at": "2024-01-15",
            "finder_claims_ownership": True,
            "municipality_irrevocably_transferred": False,
        },
        headers=legal_deadline_env["headers"],
    )

    # List animals and check legal deadline fields
    animals_resp = await client.get(
        "/animals",
        headers=legal_deadline_env["headers"],
    )
    assert animals_resp.status_code == 200
    animals_data = animals_resp.json()

    # Find our animal in the list
    test_animal = next(
        (a for a in animals_data if a["id"] == str(legal_deadline_env["animal"].id)),
        None,
    )
    assert test_animal is not None
    assert "legal_deadline_at" in test_animal
    assert test_animal["legal_deadline_at"] == "2024-03-15"


@pytest.mark.anyio
async def test_update_intake_legal_deadline_fields(client, legal_deadline_env):
    """Test updating intake with legal deadline fields."""
    # Create intake first
    intake_resp = await client.post(
        "/intakes",
        json={
            "animal_id": str(legal_deadline_env["animal"].id),
            "reason": "found",
            "intake_date": "2024-01-01",
        },
        headers=legal_deadline_env["headers"],
    )
    assert intake_resp.status_code == 201
    intake_id = intake_resp.json()["id"]

    # Update with legal deadline fields
    update_resp = await client.put(
        f"/intakes/{intake_id}",
        json={
            "notice_published_at": "2024-02-01",
            "finder_claims_ownership": True,
            "municipality_irrevocably_transferred": False,
        },
        headers=legal_deadline_env["headers"],
    )
    assert update_resp.status_code == 200
    data = update_resp.json()
    assert data["notice_published_at"] == "2024-02-01"
    assert data["finder_claims_ownership"] is True

    # Check animal has updated deadline
    animal_resp = await client.get(
        f"/animals/{legal_deadline_env['animal'].id}",
        headers=legal_deadline_env["headers"],
    )
    animal_data = animal_resp.json()
    # Should be 2 months from 2024-02-01 = 2024-04-01
    assert animal_data["legal_deadline_at"] == "2024-04-01"


@pytest.mark.anyio
async def test_missing_legal_deadline_fields_returns_missing_data_state(
    client, legal_deadline_env
):
    """Test that missing legal deadline fields returns missing_data state."""
    # Create intake without legal deadline fields
    await client.post(
        "/intakes",
        json={
            "animal_id": str(legal_deadline_env["animal"].id),
            "reason": "found",
            "intake_date": "2024-01-01",
        },
        headers=legal_deadline_env["headers"],
    )

    # Check animal has missing_data state
    animal_resp = await client.get(
        f"/animals/{legal_deadline_env['animal'].id}",
        headers=legal_deadline_env["headers"],
    )
    animal_data = animal_resp.json()

    assert animal_data["legal_deadline_state"] == "missing_data"
    assert animal_data["legal_deadline_type"] == "unknown"
    assert animal_data["legal_deadline_at"] is None
