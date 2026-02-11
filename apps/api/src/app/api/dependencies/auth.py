import uuid
from typing import Callable

from fastapi import Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.dependencies.database import get_db
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

    # Try header first, fallback to JWT claim
    org_id_str = x_organization_id or payload.get("org_id")

    if org_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No organization selected. Please select an organization first.",
        )
    try:
        return uuid.UUID(org_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid organization ID",
        )


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    payload = decode_token(token)
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
    return user


def require_permission(permission_key: str) -> Callable:
    async def _check(
        organization_id: uuid.UUID,
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
