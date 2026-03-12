"""Tests for user profile endpoints (GET /auth/me, PATCH /auth/me, avatar upload)."""

import uuid
import pytest
from sqlalchemy import delete

from src.app.models.user import User
from tests.conftest import make_org_headers

pytestmark = pytest.mark.anyio


async def test_get_me_returns_profile_photo_url(client, test_user, auth_headers):
    """Test that GET /auth/me returns profile_photo_url field."""
    resp = await client.get("/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()

    # Verify user fields including profile_photo_url
    assert "user" in data
    user_data = data["user"]
    assert user_data["email"] == test_user.email
    assert user_data["name"] == test_user.name
    # profile_photo_url should exist (may be None initially)
    assert "profile_photo_url" in user_data


async def test_get_me_without_profile_photo(client, test_user, auth_headers):
    """Test that GET /auth/me works when user has no profile photo."""
    resp = await client.get("/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()

    # New user should have null profile_photo_url
    assert data["user"]["profile_photo_url"] is None


async def test_update_profile_name(client, test_user, auth_headers, test_org):
    """Test PATCH /auth/me can update user name."""
    headers = make_org_headers(auth_headers, test_org.id)

    new_name = "Updated Test User"
    resp = await client.patch(
        "/auth/me",
        headers=headers,
        json={"name": new_name}
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["name"] == new_name
    assert data["email"] == test_user.email


async def test_update_profile_phone(client, test_user, auth_headers, test_org):
    """Test PATCH /auth/me can update user phone."""
    headers = make_org_headers(auth_headers, test_org.id)

    new_phone = "+420 123 456 789"
    resp = await client.patch(
        "/auth/me",
        headers=headers,
        json={"phone": new_phone}
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["phone"] == new_phone


async def test_update_profile_clears_phone(client, test_user, auth_headers, test_org, db_session):
    """Test PATCH /auth/me can clear user phone by sending empty string."""
    # First set a phone
    test_user.phone = "+420 111 222 333"
    db_session.add(test_user)
    await db_session.commit()

    headers = make_org_headers(auth_headers, test_org.id)

    # Clear phone
    resp = await client.patch(
        "/auth/me",
        headers=headers,
        json={"phone": ""}
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["phone"] is None


async def test_update_profile_photo_url(client, test_user, auth_headers, test_org):
    """Test PATCH /auth/me can set profile_photo_url."""
    headers = make_org_headers(auth_headers, test_org.id)

    photo_url = "https://example.com/photo.jpg"
    resp = await client.patch(
        "/auth/me",
        headers=headers,
        json={"profile_photo_url": photo_url}
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["profile_photo_url"] == photo_url


async def test_update_profile_clears_photo_url(client, test_user, auth_headers, test_org, db_session):
    """Test PATCH /auth/me can clear profile_photo_url."""
    # First set a photo URL
    if hasattr(test_user, 'profile_photo_url'):
        test_user.profile_photo_url = "https://example.com/old-photo.jpg"
        db_session.add(test_user)
        await db_session.commit()

    headers = make_org_headers(auth_headers, test_org.id)

    # Clear photo URL
    resp = await client.patch(
        "/auth/me",
        headers=headers,
        json={"profile_photo_url": ""}
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["profile_photo_url"] is None


async def test_update_profile_multiple_fields(client, test_user, auth_headers, test_org):
    """Test PATCH /auth/me can update multiple fields at once."""
    headers = make_org_headers(auth_headers, test_org.id)

    resp = await client.patch(
        "/auth/me",
        headers=headers,
        json={
            "name": "Multi Update User",
            "phone": "+420 999 888 777",
            "profile_photo_url": "https://example.com/multi.jpg"
        }
    )
    assert resp.status_code == 200
    data = resp.json()

    assert data["name"] == "Multi Update User"
    assert data["phone"] == "+420 999 888 777"
    assert data["profile_photo_url"] == "https://example.com/multi.jpg"


async def test_update_profile_empty_name_fails(client, auth_headers, test_org):
    """Test PATCH /auth/me rejects empty name."""
    headers = make_org_headers(auth_headers, test_org.id)

    resp = await client.patch(
        "/auth/me",
        headers=headers,
        json={"name": ""}
    )
    # Should fail validation (name min_length=1)
    assert resp.status_code == 422


async def test_get_me_unauthenticated(client):
    """Test GET /auth/me requires authentication."""
    resp = await client.get("/auth/me")
    assert resp.status_code in [401, 403]


async def test_update_profile_unauthenticated(client):
    """Test PATCH /auth/me requires authentication."""
    resp = await client.patch("/auth/me", json={"name": "Hacker"})
    assert resp.status_code in [401, 403]


async def test_get_me_no_greenlet_error(client, test_user, auth_headers):
    """
    Test that GET /auth/me doesn't cause greenlet/lazy-loading errors.

    This test ensures all User fields are properly loaded via load_only()
    in get_current_user dependency, preventing SQLAlchemy from attempting
    lazy loads outside of async context.
    """
    resp = await client.get("/auth/me", headers=auth_headers)

    # If we get 500, it's likely a greenlet error from lazy loading
    assert resp.status_code == 200, f"Expected 200, got {resp.status_code}. Body: {resp.text}"

    data = resp.json()

    # Verify all expected fields are present and accessible
    user_data = data["user"]
    assert "id" in user_data
    assert "email" in user_data
    assert "name" in user_data
    assert "phone" in user_data
    assert "profile_photo_url" in user_data
    assert "is_superadmin" in user_data
    assert "totp_enabled" in user_data
    assert "created_at" in user_data


async def test_get_me_multiple_calls_no_error(client, test_user, auth_headers):
    """
    Test multiple calls to GET /auth/me work correctly.

    This catches issues with request caching and session management.
    """
    for _ in range(3):
        resp = await client.get("/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["user"]["email"] == test_user.email
