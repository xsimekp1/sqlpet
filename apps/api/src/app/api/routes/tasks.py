from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from src.app.api.deps import get_current_user, get_db
from src.app.models.user import User
from src.app.schemas.task import TaskResponse, TaskCreate, TaskUpdate
from src.app.services.task_service import TaskService

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("/", response_model=List[TaskResponse])
async def list_tasks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all tasks for the current user's organization."""
    task_service = TaskService(db)
    tasks = await task_service.get_tasks_for_organization(current_user.organization_id)
    return tasks
