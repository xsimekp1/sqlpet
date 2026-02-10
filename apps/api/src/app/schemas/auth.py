import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    name: str = Field(..., min_length=1, max_length=255)
    phone: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


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
