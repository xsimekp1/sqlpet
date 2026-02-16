import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

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


class BulkTaskCreate(BaseModel):
    animal_ids: List[str]
    title: str
    task_type: TaskType = TaskType.MEDICAL
    priority: TaskPriority = TaskPriority.HIGH
    due_at: Optional[datetime] = None
    notes: Optional[str] = None


@router.post("/bulk", status_code=status.HTTP_201_CREATED)
async def bulk_create_tasks(
    data: BulkTaskCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Create one task per animal_id in bulk."""
    task_service = TaskService(db)
    created_ids = []
    for animal_id_str in data.animal_ids:
        try:
            animal_uuid = uuid.UUID(animal_id_str)
        except ValueError:
            continue
        task = await task_service.create_task(
            organization_id=organization_id,
            created_by_id=current_user.id,
            title=data.title,
            description=data.notes,
            task_type=data.task_type,
            priority=data.priority,
            due_at=data.due_at,
            related_entity_type="animal",
            related_entity_id=animal_uuid,
        )
        created_ids.append(str(task.id))
    await db.commit()
    return {"created": len(created_ids), "task_ids": created_ids}


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    task_data: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """Create a new task."""
    print(
        f"[DEBUG] create_task: org={organization_id}, user={current_user.id}, title={task_data.title!r}, type={task_data.type!r}, priority={task_data.priority!r}"
    )
    task_service = TaskService(db)

    try:
        task_type = TaskType(task_data.type)
    except ValueError:
        print(f"[DEBUG] create_task: invalid task_type={task_data.type!r}")
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

    try:
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
            linked_inventory_item_id=task_data.linked_inventory_item_id,
        )
        print(f"[DEBUG] create_task: flush OK, task.id={task.id}")
        await db.commit()
        print(f"[DEBUG] create_task: commit OK, task.id={task.id}")
    except Exception as e:
        print(f"[DEBUG] create_task: FAILED with {type(e).__name__}: {e!r}")
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to create task: {str(e)}",
        )
    return task


@router.get("", response_model=TaskListResponse)
async def list_tasks(
    status: Optional[str] = Query(None, description="Filter by status"),
    type: Optional[str] = Query(None, description="Filter by type"),
    assigned_to_id: Optional[uuid.UUID] = Query(None, description="Filter by assignee"),
    due_date: Optional[str] = Query(
        None, description="Filter by due date (YYYY-MM-DD)"
    ),
    related_entity_id: Optional[str] = Query(
        None, description="Filter by related entity ID"
    ),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=1000, description="Items per page"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    organization_id: uuid.UUID = Depends(get_current_organization_id),
):
    """List tasks for the current user's organization with filters."""
    task_service = TaskService(db)

    # Convert type string to enum if provided
    type_enum = None
    if type:
        try:
            type_enum = TaskType(type)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid task type: {type}",
            )

    related_entity_uuid = uuid.UUID(related_entity_id) if related_entity_id else None

    try:
        tasks, total = await task_service.get_tasks_for_organization(
            organization_id=organization_id,
            status=status,  # Pass raw string; service handles 'active' pseudo-status
            task_type=type_enum,
            assigned_to_id=assigned_to_id,
            due_date=due_date,
            related_entity_id=related_entity_uuid,
            skip=(page - 1) * page_size,
            limit=page_size,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch tasks: {str(e)}")

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
    print(f"[DEBUG] complete_task: task_id={task_id}, data={complete_data}")
    task_service = TaskService(db)

    try:
        task = await task_service.complete_task(
            task_id=task_id,
            organization_id=organization_id,
            completed_by_id=current_user.id,
            completion_data=complete_data.completion_data,
        )
        # If medical task with linked inventory item → deduct 1 unit and log to timeline
        if (
            task.type == TaskType.MEDICAL
            and task.linked_inventory_item_id
            and task.related_entity_type == "animal"
        ):
            from src.app.services.inventory_service import InventoryService
            from src.app.models.inventory_transaction import TransactionType
            from src.app.models.inventory_item import InventoryItem as InvItem
            from src.app.services.audit_service import AuditService as _AuditService
            from sqlalchemy import select as _sel

            inv_service = InventoryService(db)
            try:
                await inv_service.record_transaction(
                    organization_id=organization_id,
                    item_id=task.linked_inventory_item_id,
                    transaction_type=TransactionType.OUT,
                    quantity=1,
                    reason=f"Vaccination task {task.id} for animal {task.related_entity_id}",
                    user_id=current_user.id,
                )
                inv_result = await db.execute(
                    _sel(InvItem).where(InvItem.id == task.linked_inventory_item_id)
                )
                inv_item = inv_result.scalar_one_or_none()
                audit = _AuditService(db)
                await audit.log_action(
                    organization_id=organization_id,
                    actor_user_id=current_user.id,
                    action="vaccination",
                    entity_type="animal",
                    entity_id=task.related_entity_id,
                    after={
                        "vaccine": inv_item.name
                        if inv_item
                        else str(task.linked_inventory_item_id)
                    },
                )
            except Exception as e:
                print(f"[DEBUG] complete_task: inventory deduction failed: {e!r}")

        # If cleaning task linked to a kennel → update last_cleaned_at
        if (
            task.type == TaskType.CLEANING
            and task.related_entity_type == "kennel"
            and task.related_entity_id
        ):
            from src.app.models.kennel import Kennel
            from sqlalchemy import select as _select
            from datetime import timezone as _tz

            kennel_result = await db.execute(
                _select(Kennel).where(
                    Kennel.id == task.related_entity_id,
                    Kennel.organization_id == organization_id,
                )
            )
            kennel = kennel_result.scalar_one_or_none()
            if kennel:
                from datetime import datetime as _dt

                kennel.last_cleaned_at = _dt.now(_tz.utc)

        await db.commit()
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
