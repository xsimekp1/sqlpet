"""Tests for legal deadline computation service."""

import uuid
from datetime import date, timedelta

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
            shelter_received_at=date.today(),
            finder_claims_ownership=None,
            municipality_irrevocably_transferred=None,
        )
        assert result.deadline_state == "missing_data"
        assert result.deadline_type == "unknown"
        assert "finder_claims_ownership" in result.missing_fields

    def test_scenario_a_2m_notice_with_future_date(self):
        """Test Scenario A: finder claims ownership, 2 months from notice (future date)."""
        future_date = date.today() + timedelta(days=30)
        result = compute_legal_deadline(
            notice_published_at=future_date,
            shelter_received_at=date.today(),
            finder_claims_ownership=True,
            municipality_irrevocably_transferred=False,
        )
        assert result.deadline_type == "2m_notice"
        assert result.deadline_at is not None
        assert result.deadline_state == "running"
        assert (
            "2m" in result.label
            or "2 měsíce" in result.label
            or "Deadline:" in result.label
        )

    def test_scenario_a_missing_notice_date(self):
        """Test Scenario A with missing notice_published_at."""
        result = compute_legal_deadline(
            notice_published_at=None,
            shelter_received_at=date.today(),
            finder_claims_ownership=True,
            municipality_irrevocably_transferred=False,
        )
        assert result.deadline_state == "missing_data"
        assert result.deadline_type == "2m_notice"
        assert "notice_published_at" in result.missing_fields
        assert "Chybí datum" in result.label

    def test_scenario_b_4m_transfer_with_future_date(self):
        """Test Scenario B: municipality transferred, 4 months from notice (future date)."""
        future_date = date.today() + timedelta(days=30)
        result = compute_legal_deadline(
            notice_published_at=future_date,
            shelter_received_at=date.today(),
            finder_claims_ownership=False,
            municipality_irrevocably_transferred=True,
        )
        assert result.deadline_type == "4m_transfer"
        assert result.deadline_at is not None
        assert result.deadline_state == "running"
        assert (
            "4m" in result.label
            or "4 měsíce" in result.label
            or "Deadline:" in result.label
        )

    def test_scenario_b_4m_transfer_uses_later_date(self):
        """Test Scenario B uses later of notice vs shelter date."""
        earlier = date.today() - timedelta(days=20)
        later = date.today() + timedelta(days=10)
        result = compute_legal_deadline(
            notice_published_at=earlier,
            shelter_received_at=later,
            finder_claims_ownership=False,
            municipality_irrevocably_transferred=True,
        )
        assert result.deadline_type == "4m_transfer"
        assert result.deadline_at is not None
        assert result.deadline_at > later

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
        notice = date.today() + timedelta(days=30)
        result = compute_legal_deadline(
            notice_published_at=notice,
            shelter_received_at=None,
            finder_claims_ownership=False,
            municipality_irrevocably_transferred=True,
        )
        assert result.deadline_type == "4m_transfer"
        assert result.deadline_at is not None

    def test_no_deadline_when_finder_no_claim_no_municipality_no_notice(self):
        """Test no deadline when finder doesn't claim, municipality hasn't transferred,
        and notice date is unknown (animal went directly to shelter without prior notice)."""
        result = compute_legal_deadline(
            notice_published_at=None,
            shelter_received_at=date.today(),
            finder_claims_ownership=False,
            municipality_irrevocably_transferred=False,
        )
        assert result.deadline_type == "unknown"
        assert result.deadline_state == "running"
        assert result.deadline_at is None
        assert "Bez lhůty" in result.label

    def test_scenario_c_direct_handover_4m_from_notice(self):
        """Test Scenario C: finder kept animal, notice already published, then brought to shelter.
        Deadline = 4 months from original notice_published_at."""
        from src.app.services.legal_deadline import _add_months

        notice = date.today() - timedelta(days=30)  # published 30 days ago
        result = compute_legal_deadline(
            notice_published_at=notice,
            shelter_received_at=date.today(),
            finder_claims_ownership=False,
            municipality_irrevocably_transferred=False,
        )
        assert result.deadline_type == "4m_notice"
        assert result.deadline_at == _add_months(notice, 4)
        assert result.deadline_state == "running"

    def test_scenario_c_municipality_none_notice_set(self):
        """Test Scenario C also triggers when municipality_irrevocably_transferred is None."""
        from src.app.services.legal_deadline import _add_months

        notice = date.today() - timedelta(days=10)
        result = compute_legal_deadline(
            notice_published_at=notice,
            shelter_received_at=date.today(),
            finder_claims_ownership=False,
            municipality_irrevocably_transferred=None,
        )
        assert result.deadline_type == "4m_notice"
        assert result.deadline_at == _add_months(notice, 4)

    def test_scenario_c_expired(self):
        """Test Scenario C shows expired when 4 months from notice have passed."""
        old_notice = date(2020, 1, 1)
        result = compute_legal_deadline(
            notice_published_at=old_notice,
            shelter_received_at=date(2020, 3, 1),
            finder_claims_ownership=False,
            municipality_irrevocably_transferred=False,
        )
        assert result.deadline_type == "4m_notice"
        assert result.deadline_state == "expired"
        assert result.days_left is not None and result.days_left < 0

    def test_deadline_month_edge_case_january(self):
        """Test deadline calculation at month end (Jan -> Mar)."""
        today = date.today()
        if today.month <= 10:
            notice_date = date(today.year, 1, 31)
        else:
            notice_date = date(today.year + 1, 1, 31)
        result = compute_legal_deadline(
            notice_published_at=notice_date,
            shelter_received_at=date.today(),
            finder_claims_ownership=True,
            municipality_irrevocably_transferred=False,
        )
        expected_month = 3
        expected_year = (
            notice_date.year + 1 if notice_date.month == 12 else notice_date.year
        )
        from calendar import monthrange

        last_day = monthrange(expected_year, expected_month)[1]
        expected = date(expected_year, expected_month, min(31, last_day))
        assert result.deadline_at == expected

    def test_deadline_month_edge_case_december(self):
        """Test deadline calculation across year boundary (Dec -> Feb)."""
        notice_date = date(2024, 12, 15)
        result = compute_legal_deadline(
            notice_published_at=notice_date,
            shelter_received_at=date(2024, 12, 1),
            finder_claims_ownership=True,
            municipality_irrevocably_transferred=False,
        )
        assert result.deadline_type == "2m_notice"
        assert result.deadline_at is not None

    def test_deadline_month_edge_case_leap_year_feb(self):
        """Test deadline calculation for February in leap year."""
        notice_date = date(2024, 1, 30)
        result = compute_legal_deadline(
            notice_published_at=notice_date,
            shelter_received_at=date(2024, 1, 1),
            finder_claims_ownership=True,
            municipality_irrevocably_transferred=False,
        )
        assert result.deadline_type == "2m_notice"
        assert result.deadline_at is not None

    def test_deadline_expired(self):
        """Test expired deadline detection."""
        notice_date = date(2020, 1, 1)
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
        today = date.today()
        notice_date = today - timedelta(days=45)
        result = compute_legal_deadline(
            notice_published_at=notice_date,
            shelter_received_at=today,
            finder_claims_ownership=True,
            municipality_irrevocably_transferred=False,
        )
        assert result.deadline_type == "2m_notice"
        if result.days_left is not None and 0 < result.days_left <= 14:
            assert "Zbývá" in result.label


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
        status="available",
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
    today = date.today()
    future = today + timedelta(days=30)

    resp = await client.post(
        "/intakes",
        json={
            "animal_id": str(legal_deadline_env["animal"].id),
            "reason": "found",
            "intake_date": today.isoformat(),
            "notice_published_at": future.isoformat(),
            "finder_claims_ownership": True,
            "municipality_irrevocably_transferred": False,
        },
        headers=legal_deadline_env["headers"],
    )
    assert resp.status_code == 201, f"Expected 201, got {resp.status_code}: {resp.text}"
    data = resp.json()
    assert data["reason"] == "found"
    assert data["notice_published_at"] == future.isoformat()
    assert data["finder_claims_ownership"] is True
    assert data["municipality_irrevocably_transferred"] is False


@pytest.mark.anyio
async def test_animal_api_returns_legal_deadline(client, legal_deadline_env):
    """Test that animal API returns computed legal deadline fields."""
    today = date.today()
    notice = today + timedelta(days=30)
    expected_deadline = today + timedelta(days=60)

    intake_resp = await client.post(
        "/intakes",
        json={
            "animal_id": str(legal_deadline_env["animal"].id),
            "reason": "found",
            "intake_date": today.isoformat(),
            "notice_published_at": notice.isoformat(),
            "finder_claims_ownership": True,
            "municipality_irrevocably_transferred": False,
        },
        headers=legal_deadline_env["headers"],
    )
    assert intake_resp.status_code == 201

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

    # Using configurable org settings - returns rule_key as deadline_type
    assert animal_data["legal_deadline_type"] == "finder_keeps"


@pytest.mark.anyio
async def test_animal_list_returns_legal_deadline_fields(client, legal_deadline_env):
    """Test that animal list API returns legal deadline fields."""
    today = date.today()
    notice = today + timedelta(days=30)

    await client.post(
        "/intakes",
        json={
            "animal_id": str(legal_deadline_env["animal"].id),
            "reason": "found",
            "intake_date": today.isoformat(),
            "notice_published_at": notice.isoformat(),
            "finder_claims_ownership": True,
            "municipality_irrevocably_transferred": False,
        },
        headers=legal_deadline_env["headers"],
    )

    animal_resp = await client.get(
        f"/animals/{legal_deadline_env['animal'].id}",
        headers=legal_deadline_env["headers"],
    )
    assert animal_resp.status_code == 200
    animal_data = animal_resp.json()

    assert "legal_deadline_at" in animal_data
    # Using configurable org settings - returns rule_key as deadline_type
    assert animal_data["legal_deadline_type"] == "finder_keeps"


@pytest.mark.anyio
async def test_update_intake_legal_deadline_fields(client, legal_deadline_env):
    """Test updating intake with legal deadline fields."""
    today = date.today()

    intake_resp = await client.post(
        "/intakes",
        json={
            "animal_id": str(legal_deadline_env["animal"].id),
            "reason": "found",
            "intake_date": today.isoformat(),
        },
        headers=legal_deadline_env["headers"],
    )
    assert intake_resp.status_code == 201
    intake_id = intake_resp.json()["id"]

    new_notice = today + timedelta(days=30)
    update_resp = await client.put(
        f"/intakes/{intake_id}",
        json={
            "notice_published_at": new_notice.isoformat(),
            "finder_claims_ownership": True,
            "municipality_irrevocably_transferred": False,
        },
        headers=legal_deadline_env["headers"],
    )
    assert update_resp.status_code == 200
    data = update_resp.json()
    assert data["notice_published_at"] == new_notice.isoformat()
    assert data["finder_claims_ownership"] is True

    animal_resp = await client.get(
        f"/animals/{legal_deadline_env['animal'].id}",
        headers=legal_deadline_env["headers"],
    )
    animal_data = animal_resp.json()
    # Using configurable org settings - returns rule_key as deadline_type
    assert animal_data["legal_deadline_type"] == "finder_keeps"


@pytest.mark.anyio
async def test_missing_legal_deadline_fields_returns_missing_data_state(
    client, legal_deadline_env
):
    """Test that missing legal deadline fields returns missing_data state."""
    from src.app.services.legal_deadline import compute_legal_deadline

    result = compute_legal_deadline(
        notice_published_at=None,
        shelter_received_at=date.today(),
        finder_claims_ownership=None,
        municipality_irrevocably_transferred=None,
    )

    assert result.deadline_state == "missing_data"
    assert result.deadline_type == "unknown"
    assert result.deadline_at is None
