import uuid

import pytest
import pyotp
from sqlalchemy import delete

from src.app.models.user import User
from src.app.core.security import hash_password

pytestmark = pytest.mark.anyio


async def test_2fa_setup_requires_auth(client, db_session):
    """Test that 2FA setup endpoint requires authentication"""
    resp = await client.post("/auth/2fa/setup")
    assert resp.status_code == 401


async def test_2fa_initiate_setup(client, test_user, auth_headers, db_session):
    """Test initiating 2FA setup returns QR code and secret"""
    resp = await client.post("/auth/2fa/setup", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "secret" in data
    assert "qr_code" in data
    assert "provisioning_uri" in data
    assert data["provisioning_uri"].startswith("otpauth://totp/")


async def test_2fa_verify_invalid_code(client, test_user, auth_headers, db_session):
    """Test that verifying with invalid code fails"""
    # First initiate setup
    resp = await client.post("/auth/2fa/setup", headers=auth_headers)
    assert resp.status_code == 200

    # Try to verify with wrong code
    resp = await client.post(
        "/auth/2fa/verify", headers=auth_headers, json={"code": "000000"}
    )
    assert resp.status_code == 400


async def test_2fa_verify_valid_code(client, test_user, auth_headers, db_session):
    """Test that verifying with valid code enables 2FA"""
    # First initiate setup
    resp = await client.post("/auth/2fa/setup", headers=auth_headers)
    data = resp.json()
    secret = data["secret"]

    # Generate valid TOTP code
    totp = pyotp.TOTP(secret)
    valid_code = totp.now()

    # Verify with valid code
    resp = await client.post(
        "/auth/2fa/verify", headers=auth_headers, json={"code": valid_code}
    )
    assert resp.status_code == 200

    # Check user has 2FA enabled
    from sqlalchemy import select

    result = await db_session.execute(select(User).where(User.id == test_user.id))
    user = result.scalar_one()
    assert user.totp_enabled is True
    assert user.totp_secret is not None

    # Cleanup
    user.totp_enabled = False
    user.totp_secret = None
    user.backup_codes = None
    await db_session.commit()


async def test_2fa_login_without_code_when_required(
    client, test_user, auth_headers, db_session
):
    """Test that login requires 2FA code when enabled"""
    # First enable 2FA
    resp = await client.post("/auth/2fa/setup", headers=auth_headers)
    data = resp.json()
    secret = data["secret"]

    totp = pyotp.TOTP(secret)
    valid_code = totp.now()

    resp = await client.post(
        "/auth/2fa/verify", headers=auth_headers, json={"code": valid_code}
    )
    assert resp.status_code == 200

    # Now try login without 2FA code
    resp = await client.post(
        "/auth/login", json={"email": test_user.email, "password": "TestPass123"}
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("require_2fa") is True


async def test_2fa_login_with_valid_code(client, test_user, auth_headers, db_session):
    """Test that login succeeds with valid 2FA code"""
    # Enable 2FA
    resp = await client.post("/auth/2fa/setup", headers=auth_headers)
    data = resp.json()
    secret = data["secret"]

    totp = pyotp.TOTP(secret)
    valid_code = totp.now()

    resp = await client.post(
        "/auth/2fa/verify", headers=auth_headers, json={"code": valid_code}
    )
    assert resp.status_code == 200

    # Login with valid 2FA code
    resp = await client.post(
        "/auth/login",
        json={
            "email": test_user.email,
            "password": "TestPass123",
            "totp_code": valid_code,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data


async def test_2fa_login_with_invalid_code(client, test_user, auth_headers, db_session):
    """Test that login fails with invalid 2FA code"""
    # Enable 2FA
    resp = await client.post("/auth/2fa/setup", headers=auth_headers)
    data = resp.json()
    secret = data["secret"]

    totp = pyotp.TOTP(secret)
    valid_code = totp.now()

    resp = await client.post(
        "/auth/2fa/verify", headers=auth_headers, json={"code": valid_code}
    )
    assert resp.status_code == 200

    # Login with invalid 2FA code
    resp = await client.post(
        "/auth/login",
        json={
            "email": test_user.email,
            "password": "TestPass123",
            "totp_code": "000000",
        },
    )
    assert resp.status_code == 401


async def test_2fa_disable(client, test_user, auth_headers, db_session):
    """Test disabling 2FA"""
    # First enable 2FA
    resp = await client.post("/auth/2fa/setup", headers=auth_headers)
    data = resp.json()
    secret = data["secret"]

    totp = pyotp.TOTP(secret)
    valid_code = totp.now()

    resp = await client.post(
        "/auth/2fa/verify", headers=auth_headers, json={"code": valid_code}
    )
    assert resp.status_code == 200

    # Disable 2FA
    resp = await client.post("/auth/2fa/disable", headers=auth_headers, json={})
    assert resp.status_code == 200

    # Verify 2FA is disabled
    from sqlalchemy import select

    result = await db_session.execute(select(User).where(User.id == test_user.id))
    user = result.scalar_one()
    assert user.totp_enabled is False


async def test_2fa_backup_codes_regeneration(
    client, test_user, auth_headers, db_session
):
    """Test regenerating backup codes"""
    # First enable 2FA
    resp = await client.post("/auth/2fa/setup", headers=auth_headers)
    data = resp.json()
    secret = data["secret"]

    totp = pyotp.TOTP(secret)
    valid_code = totp.now()

    resp = await client.post(
        "/auth/2fa/verify", headers=auth_headers, json={"code": valid_code}
    )
    assert resp.status_code == 200

    # Regenerate backup codes
    resp = await client.post("/auth/2fa/backup-codes", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "codes" in data
    assert len(data["codes"]) == 8
