import uuid
from typing import Callable

from fastapi import Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.dependencies.db import get_db
from src.app.core.security import decode_token
from src.app.models.user import User
from src.app.models.membership import Membership, MembershipStatus
from src.app.services.permission_service import PermissionService

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=True)


async def get_current_organization_id(
    token: str = Depends(oauth2_scheme),
    x_organization_id: str | None = Header(None, alias="x-organization-id"),
) -> uuid.UUID:
    """
    Extract organization_id from JWT token or header.
    For M3: organization_id is stored in 'org_id' claim.
    M4: Also accept x-organization-id header for compatibility.
    TODO M4: Validate user has active membership in this organization.
    """
    payload = decode_token(token)
    print(f"[ORG DEBUG] Token payload: {payload}")
    print(f"[ORG DEBUG] x-organization-id header: {x_organization_id}")

    # Try header first, fallback to JWT claim
    org_id_str = x_organization_id or payload.get("org_id")
    print(f"[ORG DEBUG] Resolved org_id: {org_id_str}")

    if org_id_str is None:
        print(f"[ORG DEBUG] No org_id found in token or header!")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No organization selected. Please select an organization first.",
        )
    try:
        return uuid.UUID(org_id_str)
    except ValueError:
        print(f"[ORG DEBUG] Invalid org_id format: {org_id_str}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid organization ID",
        )


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    print(f"[AUTH DEBUG] Token received: {token[:20]}...{token[-20:]}")
    try:
        payload = decode_token(token)
        print(f"[AUTH DEBUG] Token payload: {payload}")
    except Exception as e:
        print(f"[AUTH DEBUG] Token decode failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token decode error: {str(e)}",
        )

    if payload.get("typ") != "access":
        print(f"[AUTH DEBUG] Invalid token type: {payload.get('typ')}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )
    user_id_str = payload.get("sub")
    if user_id_str is None:
        print(f"[AUTH DEBUG] No 'sub' in token payload")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
        print(f"[AUTH DEBUG] Invalid user_id format: {user_id_str}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


def require_permission(permission_key: str) -> Callable:
    async def _check(
        organization_id: uuid.UUID = Depends(get_current_organization_id),
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        svc = PermissionService(db)
        has = await svc.user_has_permission(
            current_user.id, organization_id, permission_key
        )
        if not has:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permission: {permission_key}",
            )
        return current_user

    return _check
