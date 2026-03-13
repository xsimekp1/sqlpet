"""Tests for outreach API endpoints."""
import uuid
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete

from src.app.models.user import User
from src.app.core.security import hash_password, create_access_token


@pytest.fixture
async def superadmin_user(db_session: AsyncSession):
    """Create a superadmin user for testing."""
    uid = uuid.uuid4()
    user = User(
        id=uid,
        email=f"superadmin-{uid.hex[:8]}@example.com",
        password_hash=hash_password("SuperAdmin123"),
        name="Super Admin",
        is_superadmin=True,
    )
    db_session.add(user)
    try:
        await db_session.commit()
    except Exception:
        await db_session.rollback()
        raise
    yield user
    try:
        await db_session.execute(delete(User).where(User.id == uid))
        await db_session.commit()
    except Exception:
        await db_session.rollback()


@pytest.fixture
async def superadmin_headers(superadmin_user: User) -> dict:
    """Headers for superadmin user."""
    token = create_access_token({"sub": str(superadmin_user.id), "superadmin": True})
    return {"Authorization": f"Bearer {token}"}


class TestOutreachCampaigns:
    """Test outreach campaign endpoints."""

    async def test_list_campaigns_requires_superadmin(
        self, client: AsyncClient, auth_headers: dict
    ):
        """Non-superadmin users cannot access outreach."""
        response = await client.get(
            "/superadmin/outreach/campaigns",
            headers=auth_headers,
        )
        assert response.status_code == 403

    async def test_create_campaign(
        self, client: AsyncClient, superadmin_headers: dict
    ):
        """Superadmin can create a campaign."""
        response = await client.post(
            "/superadmin/outreach/campaigns",
            headers=superadmin_headers,
            json={
                "name": "Test Campaign Q1",
                "description": "Test campaign for shelters",
                "subject_template": "PawShelter pro {shelter_name}",
                "from_email": "test@example.com",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Campaign Q1"
        assert data["status"] == "draft"
        assert data["sent_count"] == 0
        assert data["replied_count"] == 0

    async def test_list_campaigns(
        self, client: AsyncClient, superadmin_headers: dict
    ):
        """Superadmin can list campaigns."""
        # Create a campaign first
        await client.post(
            "/superadmin/outreach/campaigns",
            headers=superadmin_headers,
            json={
                "name": "List Test Campaign",
                "subject_template": "Test subject",
            },
        )

        response = await client.get(
            "/superadmin/outreach/campaigns",
            headers=superadmin_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1

    async def test_get_campaign(
        self, client: AsyncClient, superadmin_headers: dict
    ):
        """Superadmin can get a single campaign."""
        # Create a campaign
        create_response = await client.post(
            "/superadmin/outreach/campaigns",
            headers=superadmin_headers,
            json={
                "name": "Get Test Campaign",
                "subject_template": "Test subject",
            },
        )
        campaign_id = create_response.json()["id"]

        response = await client.get(
            f"/superadmin/outreach/campaigns/{campaign_id}",
            headers=superadmin_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == campaign_id
        assert data["name"] == "Get Test Campaign"

    async def test_update_campaign_status(
        self, client: AsyncClient, superadmin_headers: dict
    ):
        """Superadmin can update campaign status."""
        # Create a campaign
        create_response = await client.post(
            "/superadmin/outreach/campaigns",
            headers=superadmin_headers,
            json={
                "name": "Status Test Campaign",
                "subject_template": "Test subject",
            },
        )
        campaign_id = create_response.json()["id"]

        # Activate it
        response = await client.patch(
            f"/superadmin/outreach/campaigns/{campaign_id}/status?new_status=active",
            headers=superadmin_headers,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "active"

        # Pause it
        response = await client.patch(
            f"/superadmin/outreach/campaigns/{campaign_id}/status?new_status=paused",
            headers=superadmin_headers,
        )
        assert response.status_code == 200
        assert response.json()["status"] == "paused"

    async def test_update_campaign_invalid_status(
        self, client: AsyncClient, superadmin_headers: dict
    ):
        """Invalid status returns error."""
        # Create a campaign
        create_response = await client.post(
            "/superadmin/outreach/campaigns",
            headers=superadmin_headers,
            json={
                "name": "Invalid Status Campaign",
                "subject_template": "Test subject",
            },
        )
        campaign_id = create_response.json()["id"]

        response = await client.patch(
            f"/superadmin/outreach/campaigns/{campaign_id}/status?new_status=invalid",
            headers=superadmin_headers,
        )
        assert response.status_code == 400


class TestOutreachEmails:
    """Test outreach email endpoints."""

    async def test_list_emails_empty_campaign(
        self, client: AsyncClient, superadmin_headers: dict
    ):
        """List emails for campaign with no emails."""
        # Create a campaign
        create_response = await client.post(
            "/superadmin/outreach/campaigns",
            headers=superadmin_headers,
            json={
                "name": "Empty Email Campaign",
                "subject_template": "Test subject",
            },
        )
        campaign_id = create_response.json()["id"]

        response = await client.get(
            f"/superadmin/outreach/campaigns/{campaign_id}/emails",
            headers=superadmin_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["items"] == []
        assert data["total"] == 0

    async def test_approve_nonexistent_email(
        self, client: AsyncClient, superadmin_headers: dict
    ):
        """Approving nonexistent email returns 404."""
        import uuid
        fake_id = str(uuid.uuid4())

        response = await client.patch(
            f"/superadmin/outreach/emails/{fake_id}/approve",
            headers=superadmin_headers,
        )
        assert response.status_code == 404

    async def test_skip_nonexistent_email(
        self, client: AsyncClient, superadmin_headers: dict
    ):
        """Skipping nonexistent email returns 404."""
        import uuid
        fake_id = str(uuid.uuid4())

        response = await client.patch(
            f"/superadmin/outreach/emails/{fake_id}/skip",
            headers=superadmin_headers,
        )
        assert response.status_code == 404

    async def test_edit_nonexistent_email(
        self, client: AsyncClient, superadmin_headers: dict
    ):
        """Editing nonexistent email returns 404."""
        import uuid
        fake_id = str(uuid.uuid4())

        response = await client.patch(
            f"/superadmin/outreach/emails/{fake_id}/edit",
            headers=superadmin_headers,
            json={"generated_subject": "New subject"},
        )
        assert response.status_code == 404

    async def test_bulk_approve_empty_list(
        self, client: AsyncClient, superadmin_headers: dict
    ):
        """Bulk approve with empty list."""
        response = await client.post(
            "/superadmin/outreach/emails/bulk-approve",
            headers=superadmin_headers,
            json={"email_ids": []},
        )
        assert response.status_code == 200
        assert response.json()["approved"] == 0
