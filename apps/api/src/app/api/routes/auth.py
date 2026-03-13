import logging
import uuid
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

logger = logging.getLogger(__name__)

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
from src.app.services.auth_service import AuthService
from src.app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    RefreshRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    UserResponse,
    CurrentUserResponse,
    UpdateProfileRequest,
    TwoFactorSetupResponse,
    TwoFactorVerifyRequest,
    TwoFactorDisableRequest,
    BackupCodesResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def get_login_rate_limit_key(request: Request) -> str:
    return request.client.host


limiter = Limiter(key_func=get_login_rate_limit_key)


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
            organization_name=request.organization_name,
        )
        await db.commit()
        return user
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/forgot-password")
@limiter.limit("5/15minutes")
async def forgot_password(
    request: Request,
    request_body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Send password reset email to user."""
    from src.app.services.email_service import EmailService
    from datetime import datetime, timedelta

    result = await db.execute(select(User).where(User.email == request_body.email))
    user = result.scalar_one_or_none()

    if user:
        import secrets

        token = secrets.token_urlsafe(32)
        user.password_reset_token = token
        user.password_reset_expires = datetime.utcnow() + timedelta(hours=1)
        await db.commit()

        try:
            EmailService.send_password_reset_email(user.email, token)
        except Exception:
            pass

    return {"message": "If the email exists, a reset link has been sent"}


@router.post("/reset-password")
async def reset_password(
    request: ResetPasswordRequest, db: AsyncSession = Depends(get_db)
):
    """Reset password using token from email."""
    from src.app.core.security import hash_password
    from datetime import datetime

    result = await db.execute(
        select(User).where(User.password_reset_token == request.token)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid token"
        )

    if (
        user.password_reset_expires is None
        or user.password_reset_expires < datetime.utcnow()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Token has expired"
        )

    user.password_hash = hash_password(request.new_password)
    user.password_reset_token = None
    user.password_reset_expires = None
    await db.commit()

    return {"message": "Password has been reset successfully"}


@router.post("/login")
@limiter.limit("10/15minutes")
async def login(
    request: Request, request_body: LoginRequest, db: AsyncSession = Depends(get_db)
):
    ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    # Look up user by email to determine failure reason for login log
    result = await db.execute(select(User).where(User.email == request_body.email))
    existing_user = result.scalar_one_or_none()

    svc = AuthService(db)
    user = await svc.authenticate_user(request_body.email, request_body.password)

    # Write login log (non-blocking — never break login flow on log failure)
    try:
        if user is not None:
            log = LoginLog(
                id=uuid.uuid4(),
                user_id=user.id,
                email=request_body.email,
                ip=ip,
                user_agent=user_agent,
                success=True,
                failure_reason=None,
            )
        else:
            failure_reason = (
                "user_not_found" if existing_user is None else "wrong_password"
            )
            log = LoginLog(
                id=uuid.uuid4(),
                user_id=existing_user.id if existing_user else None,
                email=request_body.email,
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

    # Check if 2FA is required
    if user.totp_enabled:
        if not request.totp_code:
            return {
                "require_2fa": True,
                "message": "Please provide your 2FA code",
            }

        two_fa_svc = TwoFactorService(db)
        if not two_fa_svc.verify_code(user.totp_secret or "", request.totp_code):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid 2FA code",
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

    # Refresh user to ensure all attributes are loaded in current async context
    try:
        await db.refresh(current_user)
    except Exception:
        pass  # Ignore refresh errors (e.g., missing columns before migration)

    # Build user response manually to handle potential missing columns gracefully
    user_response = UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        phone=current_user.phone,
        profile_photo_url=getattr(current_user, "profile_photo_url", None),
        is_superadmin=current_user.is_superadmin,
        totp_enabled=current_user.totp_enabled,
        created_at=current_user.created_at,
    )

    return CurrentUserResponse(
        user=user_response,
        memberships=membership_infos,
    )


@router.patch("/me", response_model=UserResponse)
async def update_me(
    data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update current user's profile (name, phone, profile_photo_url)."""
    if data.name is not None:
        current_user.name = data.name
    if data.phone is not None:
        current_user.phone = data.phone if data.phone else None
    if data.profile_photo_url is not None:
        # Only set if column exists (migration may not have run yet)
        if hasattr(current_user, "profile_photo_url"):
            current_user.profile_photo_url = (
                data.profile_photo_url if data.profile_photo_url else None
            )

    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)

    # Build response manually to handle potential missing columns
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        phone=current_user.phone,
        profile_photo_url=getattr(current_user, "profile_photo_url", None),
        is_superadmin=current_user.is_superadmin,
        totp_enabled=current_user.totp_enabled,
        created_at=current_user.created_at,
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


@router.post("/2fa/setup", response_model=TwoFactorSetupResponse)
async def setup_2fa(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Initiate 2FA setup - returns QR code for authenticator app."""
    svc = TwoFactorService(db)
    try:
        secret, qr_code, provisioning_uri = await svc.initiate_setup(current_user)
        await db.commit()
        return TwoFactorSetupResponse(
            secret=secret,
            qr_code=qr_code,
            provisioning_uri=provisioning_uri,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/2fa/verify")
async def verify_2fa(
    request: TwoFactorVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify 2FA code and enable 2FA."""
    svc = TwoFactorService(db)
    success = await svc.verify_and_enable(current_user, request.code)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code",
        )
    await db.commit()
    return {"message": "2FA enabled successfully"}


@router.post("/2fa/disable")
async def disable_2fa(
    request: TwoFactorDisableRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Disable 2FA for current user."""
    svc = TwoFactorService(db)
    try:
        success = await svc.disable(current_user, request.code)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification code",
            )
        await db.commit()
        return {"message": "2FA disabled successfully"}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/2fa/backup-codes", response_model=BackupCodesResponse)
async def regenerate_backup_codes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Regenerate backup codes for 2FA."""
    svc = TwoFactorService(db)
    try:
        codes = await svc.regenerate_backup_codes(current_user)
        await db.commit()
        return BackupCodesResponse(codes=codes)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
