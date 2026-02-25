import uuid
from typing import Literal

from pydantic import BaseModel, Field, field_validator


LeadInterest = Literal["free", "demo", "beta"]


class LeadCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: str | None = None
    phone: str | None = None
    interest: LeadInterest
    shelter_name: str | None = Field(None, max_length=255)
    notes: str | None = None

    @field_validator("email", "phone")
    @classmethod
    def at_least_one_contact(cls, v, info):
        # This validator runs after all fields are parsed
        # We'll do the cross-field validation in the endpoint
        return v


class LeadUpdate(BaseModel):
    is_processed: bool | None = None
    notes: str | None = None


class LeadResponse(BaseModel):
    id: uuid.UUID
    name: str
    email: str | None
    phone: str | None
    interest: str
    shelter_name: str | None
    notes: str | None
    is_processed: bool
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}
