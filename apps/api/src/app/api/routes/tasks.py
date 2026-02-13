import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from src.app.api.dependencies.auth import get_current_user, get_current_organization_id
from src.app.api.dependencies.db import get_db
from src.app.models.user import User
from src.app.models.task import TaskType, TaskStatus, TaskPriority
from src.app.schemas.task import (
    TaskResponse,
    TaskCreate,
    TaskUpdate,
    TaskAssign,
    TaskComplete,
    TaskListResponse,
)
from src.app.services.task_service import TaskService

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    task_data: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Create a new task."""
    print(f"[DEBUG] create_task called with data: {task_data}")
    task_service = TaskService(db)

    try:
        task_type = TaskType(task_data.type)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid task type: {task_data.type}",
        )

    try:
        priority = (
            TaskPriority(task_data.priority)
            if task_data.priority
            else TaskPriority.MEDIUM
        )
    except ValueError:
        priority = TaskPriority.MEDIUM

    task = await task_service.create_task(
        organization_id=organization_id,
        created_by_id=current_user.id,
        title=task_data.title,
        description=task_data.description,
        task_type=task_type,
        priority=priority,
        assigned_to_id=task_data.assigned_to_id,
        due_at=task_data.due_at,
        task_metadata=task_data.task_metadata,
        related_entity_type=task_data.related_entity_type,
        related_entity_id=task_data.related_entity_id,
    )
    await db.commit()
    return task


@router.get("/", response_model=TaskListResponse)
async def list_tasks(
    status: Optional[str] = Query(None, description="Filter by status"),
    type: Optional[str] = Query(None, description="Filter by type"),
    assigned_to_id: Optional[uuid.UUID] = Query(None, description="Filter by assignee"),
    due_date: Optional[str] = Query(
        None, description="Filter by due date (YYYY-MM-DD)"
    ),
    related_entity_id: Optional[str] = Query(None, description="Filter by related entity ID"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """List tasks for the current user's organization with filters."""
    task_service = TaskService(db)

    # Convert status/type strings to enums if provided
    status_enum = TaskStatus(status) if status else None
    type_enum = TaskType(type) if type else None

    related_entity_uuid = uuid.UUID(related_entity_id) if related_entity_id else None

    tasks = await task_service.get_tasks_for_organization(
        organization_id=organization_id,
        status=status_enum,
        task_type=type_enum,
        assigned_to_id=assigned_to_id,
        due_date=due_date,
        related_entity_id=related_entity_uuid,
        skip=(page - 1) * page_size,
        limit=page_size,
    )

    # TODO: Add total count query for pagination
    total = len(tasks)

    return TaskListResponse(
        items=tasks,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Get a single task by ID."""
    task_service = TaskService(db)
    task = await task_service.get_task_by_id(task_id, organization_id)

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task {task_id} not found",
        )

    return task


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: uuid.UUID,
    task_data: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Update a task."""
    task_service = TaskService(db)

    try:
        # Filter out None values
        updates = {k: v for k, v in task_data.dict().items() if v is not None}

        task = await task_service.update_task(
            task_id=task_id,
            organization_id=organization_id,
            user_id=current_user.id,
            **updates,
        )
        await db.commit()
        return task
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.post("/{task_id}/assign", response_model=TaskResponse)
async def assign_task(
    task_id: uuid.UUID,
    assign_data: TaskAssign,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Assign a task to a user."""
    task_service = TaskService(db)

    try:
        task = await task_service.assign_task(
            task_id=task_id,
            organization_id=organization_id,
            assigned_to_id=assign_data.assigned_to_id,
            assigned_by_id=current_user.id,
        )
        await db.commit()
        return task
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )


@router.post("/{task_id}/complete", response_model=TaskResponse)
async def complete_task(
    task_id: uuid.UUID,
    complete_data: TaskComplete,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Complete a task."""
    task_service = TaskService(db)

    try:
        task = await task_service.complete_task(
            task_id=task_id,
            organization_id=organization_id,
            completed_by_id=current_user.id,
            completion_data=complete_data.completion_data,
        )
        await db.commit()

        # TODO: M4 - If task is feeding type, trigger feeding log creation
        # This will be implemented in the feeding integration phase

        return task
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_task(
    task_id: uuid.UUID,
    reason: Optional[str] = Query(None, description="Cancellation reason"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Cancel a task."""
    task_service = TaskService(db)

    try:
        await task_service.cancel_task(
            task_id=task_id,
            organization_id=organization_id,
            cancelled_by_id=current_user.id,
            reason=reason,
        )
        await db.commit()
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
