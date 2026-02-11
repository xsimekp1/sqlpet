from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import uuid


class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    priority: Optional[str] = "medium"
    status: Optional[str] = "todo"
    assigned_to_id: Optional[uuid.UUID] = None
    due_at: Optional[datetime] = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assigned_to_id: Optional[uuid.UUID] = None
    due_at: Optional[datetime] = None


class TaskResponse(TaskBase):
    id: uuid.UUID
    organization_id: uuid.UUID
    created_by_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
