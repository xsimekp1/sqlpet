import uuid
from typing import Callable

from fastapi import Depends, HTTPException, Request, status, Header
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.dependencies.db import get_db
from src.app.core.security import decode_token
from src.app.models.user import User
from src.app.models.membership import Membership, MembershipStatus
from src.app.services.permission_service import PermissionService

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


async def get_current_organization_id(
    request: Request,
    token: str | None = Depends(oauth2_scheme),
    x_organization_id: str | None = Header(None, alias="x-organization-id"),
) -> uuid.UUID:
    """
    Extract organization_id from JWT token or header.
    For M3: organization_id is stored in 'org_id' claim.
    M4: Also accept x-organization-id header for compatibility.
    TODO M4: Validate user has active membership in this organization.
    """
    # Check cache first
    if hasattr(request.state, "_cached_org_id"):
        return request.state._cached_org_id

    print(
        f"DEBUG get_current_organization_id called, token present: {token is not None}, x_org_id: {x_organization_id}"
    )

    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_token(token)
        print(f"DEBUG: org_id from token: {payload.get('org_id')}")
    except Exception as e:
        print(f"DEBUG: decode_token failed in get_current_organization_id: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)[:100]}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    org_id_str = x_organization_id or payload.get("org_id")

    if org_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No organization selected. Please select an organization first.",
        )
    try:
        org_id = uuid.UUID(org_id_str)
        # Cache for this request
        request.state._cached_org_id = org_id
        return org_id
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid organization ID: {org_id_str}",
        )


async def get_current_user(
    request: Request,
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    # Check cache first
    if hasattr(request.state, "_cached_user"):
        return request.state._cached_user

    print(f"DEBUG get_current_user called, token present: {token is not None}")
    if token is None:
        print("DEBUG: No token in get_current_user")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = decode_token(token)
        print(f"DEBUG: token decoded, sub: {payload.get('sub')}")
    except Exception as e:
        print(f"DEBUG: decode_token failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("typ") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )
    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
    try:
        user_id = uuid.UUID(user_id_str)
    except ValueError:
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
    # Cache for this request
    request.state._cached_user = user
    return user


def require_permission(permission_key: str) -> Callable:
    async def _check(
        organization_id: uuid.UUID = Depends(get_current_organization_id),
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
        token: str | None = Depends(oauth2_scheme),
    ) -> User:
        # Check superadmin from token
        is_superadmin = False
        user_email = current_user.email
        if token:
            try:
                payload = decode_token(token)
                is_superadmin = payload.get("superadmin", False)
            except Exception:
                pass

        svc = PermissionService(db, is_superadmin=is_superadmin, user_email=user_email)
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
