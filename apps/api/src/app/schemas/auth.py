import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    name: str = Field(..., min_length=1, max_length=255)
    phone: str | None = None
    organization_name: str = Field(
        ...,
        min_length=1,
        max_length=255,
        description="Name of the shelter/organization",
    )


class LoginRequest(BaseModel):
    email: str
    password: str
    totp_code: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    phone: str | None
    is_superadmin: bool
    totp_enabled: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class MembershipInfo(BaseModel):
    id: uuid.UUID
    organization_id: uuid.UUID
    organization_name: str
    role_name: str | None
    status: str

    model_config = {"from_attributes": True}


class CurrentUserResponse(BaseModel):
    user: UserResponse
    memberships: list[MembershipInfo]


class TwoFactorSetupResponse(BaseModel):
    secret: str
    qr_code: str
    provisioning_uri: str


class TwoFactorVerifyRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)


class TwoFactorSetupRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)


class TwoFactorDisableRequest(BaseModel):
    code: str | None = Field(None, min_length=6, max_length=6)


class BackupCodesResponse(BaseModel):
    codes: list[str]
