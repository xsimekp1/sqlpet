import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.api.dependencies.database import get_db
from src.app.api.dependencies.auth import get_current_user
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

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
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
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    svc = AuthService(db)
    user = await svc.authenticate_user(request.email, request.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
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
    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
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
        data={"sub": str(current_user.id), "org_id": str(org_uuid)}
    )
    refresh_token = create_refresh_token(
        data={"sub": str(current_user.id), "org_id": str(org_uuid)}
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
