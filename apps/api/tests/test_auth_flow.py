import uuid

import pytest
from sqlalchemy import delete

from src.app.models.user import User

pytestmark = pytest.mark.anyio


async def test_register_new_user(client, db_session):
    email = f"reg-{uuid.uuid4().hex[:8]}@example.com"
    resp = await client.post("/auth/register", json={
        "email": email,
        "password": "StrongPass1",
        "name": "New User",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == email
    assert data["name"] == "New User"
    assert "id" in data

    # Cleanup
    await db_session.execute(delete(User).where(User.id == uuid.UUID(data["id"])))
    await db_session.commit()


async def test_register_duplicate_email(client, test_user, db_session):
    resp = await client.post("/auth/register", json={
        "email": test_user.email,
        "password": "Whatever123",
        "name": "Dup User",
    })
    assert resp.status_code == 400
    assert "already registered" in resp.json()["detail"].lower()


async def test_login_valid(client, test_user):
    resp = await client.post("/auth/login", json={
        "email": test_user.email,
        "password": "TestPass123",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"
    assert data["expires_in"] > 0


async def test_login_invalid(client, test_user):
    resp = await client.post("/auth/login", json={
        "email": test_user.email,
        "password": "WrongPassword",
    })
    assert resp.status_code == 401


async def test_get_me_authenticated(client, test_user, auth_headers):
    resp = await client.get("/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["email"] == test_user.email
    assert data["user"]["name"] == test_user.name
    assert isinstance(data["memberships"], list)


async def test_get_me_unauthenticated(client):
    resp = await client.get("/auth/me")
    assert resp.status_code == 401


async def test_refresh_token(client, test_user):
    # Login first
    login_resp = await client.post("/auth/login", json={
        "email": test_user.email,
        "password": "TestPass123",
    })
    refresh_token = login_resp.json()["refresh_token"]

    # Refresh
    resp = await client.post("/auth/refresh", json={
        "refresh_token": refresh_token,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


async def test_refresh_token_invalid(client):
    resp = await client.post("/auth/refresh", json={
        "refresh_token": "invalid.token.here",
    })
    assert resp.status_code == 401
