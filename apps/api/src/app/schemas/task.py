from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Dict, Any
import uuid


class TaskBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    type: str = "general"  # general, feeding, medical, cleaning, maintenance, administrative
    priority: str = "medium"  # low, medium, high, urgent
    assigned_to_id: Optional[uuid.UUID] = None
    due_at: Optional[datetime] = None
    task_metadata: Optional[Dict[str, Any]] = None
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[uuid.UUID] = None


class TaskCreate(TaskBase):
    """Schema for creating a new task."""
    pass


class TaskUpdate(BaseModel):
    """Schema for updating a task."""
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = None
    type: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    assigned_to_id: Optional[uuid.UUID] = None
    due_at: Optional[datetime] = None
    task_metadata: Optional[Dict[str, Any]] = None
    related_entity_type: Optional[str] = None
    related_entity_id: Optional[uuid.UUID] = None


class TaskAssign(BaseModel):
    """Schema for assigning a task."""
    assigned_to_id: uuid.UUID


class TaskComplete(BaseModel):
    """Schema for completing a task."""
    notes: Optional[str] = None
    completion_data: Optional[Dict[str, Any]] = None


class TaskResponse(TaskBase):
    """Schema for task response."""
    id: uuid.UUID
    organization_id: uuid.UUID
    created_by_id: uuid.UUID
    status: str  # pending, in_progress, completed, cancelled
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TaskListResponse(BaseModel):
    """Schema for paginated task list."""
    items: list[TaskResponse]
    total: int
    page: int
    page_size: int
