import logging
import uuid
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.dependencies.db import get_db
from src.app.api.dependencies.auth import get_current_user, get_current_organization_id
from src.app.core.config import settings
from src.app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
)
from src.app.models.user import User
from src.app.models.organization import Organization
from src.app.models.role import Role
from src.app.models.membership import Membership, MembershipStatus
from src.app.models.login_log import LoginLog
from src.app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    UserResponse,
    CurrentUserResponse,
    MembershipInfo,
)
from src.app.services.auth_service import AuthService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED
)
async def register(request: RegisterRequest, db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    try:
        user = await svc.register_user(
            email=request.email,
            password=request.password,
            name=request.name,
            phone=request.phone,
        )
        await db.commit()
        return user
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, http_request: Request, db: AsyncSession = Depends(get_db)):
    ip = http_request.client.host if http_request.client else None
    user_agent = http_request.headers.get("user-agent")

    # Look up user by email to determine failure reason for login log
    result = await db.execute(select(User).where(User.email == request.email))
    existing_user = result.scalar_one_or_none()

    svc = AuthService(db)
    user = await svc.authenticate_user(request.email, request.password)

    # Write login log (non-blocking — never break login flow on log failure)
    try:
        if user is not None:
            log = LoginLog(
                id=uuid.uuid4(),
                user_id=user.id,
                email=request.email,
                ip=ip,
                user_agent=user_agent,
                success=True,
                failure_reason=None,
            )
        else:
            failure_reason = "user_not_found" if existing_user is None else "wrong_password"
            log = LoginLog(
                id=uuid.uuid4(),
                user_id=existing_user.id if existing_user else None,
                email=request.email,
                ip=ip,
                user_agent=user_agent,
                success=False,
                failure_reason=failure_reason,
            )
        db.add(log)
        await db.flush()
    except Exception as e:
        logger.warning(f"Failed to write login log: {e}")

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    access_token = create_access_token(
        {"sub": str(user.id), "superadmin": user.is_superadmin}
    )
    refresh_token = create_refresh_token(
        {"sub": str(user.id), "superadmin": user.is_superadmin}
    )
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.JWT_ACCESS_TTL_MIN * 60,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(request: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(request.refresh_token)
    if payload.get("typ") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )
    svc = AuthService(db)
    user = await svc.get_user_by_id(payload["sub"])
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    access_token = create_access_token(
        {"sub": str(user.id), "superadmin": user.is_superadmin}
    )
    refresh_token = create_refresh_token(
        {"sub": str(user.id), "superadmin": user.is_superadmin}
    )
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.JWT_ACCESS_TTL_MIN * 60,
    )


@router.get("/me", response_model=CurrentUserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import select
    from src.app.models.membership import Membership

    svc = AuthService(db)
    memberships = await svc.get_user_memberships(current_user.id)

    membership_infos = []
    for m in memberships:
        # Fetch org name and role name
        org_result = await db.execute(
            select(Organization.name).where(Organization.id == m.organization_id)
        )
        org_name = org_result.scalar_one_or_none() or "Unknown"

        role_name = None
        if m.role_id:
            role_result = await db.execute(
                select(Role.name).where(Role.id == m.role_id)
            )
            role_name = role_result.scalar_one_or_none()

        membership_infos.append(
            MembershipInfo(
                id=m.id,
                organization_id=m.organization_id,
                organization_name=org_name,
                role_name=role_name,
                status=m.status.value,
            )
        )

    # Hardcode admin@example.com as superadmin (not persisted in DB)
    if current_user.email == "admin@example.com":
        current_user.is_superadmin = True

    return CurrentUserResponse(
        user=UserResponse.model_validate(current_user),
        memberships=membership_infos,
    )


@router.post("/select-organization")
async def select_organization(
    organization_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """
    M3: Select organization and get new token with org_id claim.
    """
    try:
        org_uuid = uuid.UUID(organization_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid organization ID format",
        )

    # Verify user has active membership
    result = await db.execute(
        select(Membership).where(
            Membership.user_id == current_user.id,
            Membership.organization_id == org_uuid,
            Membership.status == MembershipStatus.ACTIVE,
        )
    )
    membership = result.scalar_one_or_none()
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this organization",
        )

    # Create new tokens with org_id claim
    access_token = create_access_token(
        data={
            "sub": str(current_user.id),
            "org_id": str(org_uuid),
            "superadmin": current_user.is_superadmin,
        }
    )
    refresh_token = create_refresh_token(
        data={
            "sub": str(current_user.id),
            "org_id": str(org_uuid),
            "superadmin": current_user.is_superadmin,
        }
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        token_type="bearer",
        expires_in=settings.JWT_ACCESS_TTL_MIN * 60,
    )


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    return {"message": "Logged out successfully"}


@router.get("/permissions")
async def get_my_permissions(
    current_user: User = Depends(get_current_user),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
    db: AsyncSession = Depends(get_db),
):
    """Get permissions for the current user in the current organization."""
    from sqlalchemy import select
    from src.app.models.membership import Membership, MembershipStatus
    from src.app.models.role_permission import RolePermission
    from src.app.models.permission import Permission

    # Get user's membership in this org
    result = await db.execute(
        select(Membership).where(
            Membership.user_id == current_user.id,
            Membership.organization_id == organization_id,
            Membership.status == MembershipStatus.ACTIVE,
        )
    )
    membership = result.scalar_one_or_none()

    permissions: list[str] = []
    if membership and membership.role_id:
        # Get permissions for the role with a single JOIN query (fixes N+1)
        perm_result = await db.execute(
            select(Permission.key)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .where(
                RolePermission.role_id == membership.role_id,
                RolePermission.allowed == True,
            )
        )
        permissions = [key for key in perm_result.scalars().all()]

    # Superadmins get all permissions
    if current_user.is_superadmin:
        all_perms_result = await db.execute(select(Permission.key))
        permissions = list(all_perms_result.scalars().all())

    return {"permissions": permissions}
