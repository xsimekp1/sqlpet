import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from src.app.api.dependencies.auth import get_current_user, get_current_organization_id
from src.app.api.dependencies.db import get_db
from src.app.models.user import User
from src.app.schemas.task import TaskResponse, TaskCreate, TaskUpdate
from src.app.services.task_service import TaskService

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("/", response_model=List[TaskResponse])
async def list_tasks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """List all tasks for the current user's organization."""
    task_service = TaskService(db)
    tasks = await task_service.get_tasks_for_organization(organization_id)
    return tasks
