from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid

from src.app.models.task import Task, TaskStatus, TaskType, TaskPriority
from src.app.services.audit_service import AuditService


class TaskService:
    def __init__(self, db: AsyncSession, audit_service: Optional[AuditService] = None):
        self.db = db
        self.audit = audit_service or AuditService(db)

    async def create_task(
        self,
        organization_id: uuid.UUID,
        created_by_id: uuid.UUID,
        title: str,
        description: Optional[str] = None,
        task_type: TaskType = TaskType.GENERAL,
        priority: TaskPriority = TaskPriority.MEDIUM,
        assigned_to_id: Optional[uuid.UUID] = None,
        due_at: Optional[datetime] = None,
        task_metadata: Optional[Dict[str, Any]] = None,
        related_entity_type: Optional[str] = None,
        related_entity_id: Optional[uuid.UUID] = None,
    ) -> Task:
        """Create a new task."""
        task = Task(
            id=uuid.uuid4(),
            organization_id=organization_id,
            created_by_id=created_by_id,
            assigned_to_id=assigned_to_id,
            title=title,
            description=description,
            type=task_type,
            priority=priority,
            status=TaskStatus.PENDING,
            due_at=due_at,
            task_metadata=task_metadata,
            related_entity_type=related_entity_type,
            related_entity_id=related_entity_id,
        )
        self.db.add(task)
        await self.db.flush()

        await self.audit.log(
            organization_id=organization_id,
            entity_type="task",
            entity_id=task.id,
            action="create",
            actor_id=created_by_id,
            changes={
                "title": title,
                "type": task_type.value,
                "status": TaskStatus.PENDING.value,
            },
        )

        return task

    async def update_task(
        self,
        task_id: uuid.UUID,
        organization_id: uuid.UUID,
        user_id: uuid.UUID,
        **updates
    ) -> Task:
        """Update task fields."""
        stmt = select(Task).where(
            and_(
                Task.id == task_id,
                Task.organization_id == organization_id,
                Task.deleted_at.is_(None),
            )
        )
        result = await self.db.execute(stmt)
        task = result.scalar_one_or_none()

        if not task:
            raise ValueError(f"Task {task_id} not found")

        changes = {}
        for key, value in updates.items():
            if hasattr(task, key) and getattr(task, key) != value:
                old_value = getattr(task, key)
                setattr(task, key, value)
                changes[key] = {"old": str(old_value), "new": str(value)}

        if changes:
            await self.db.flush()
            await self.audit.log(
                organization_id=organization_id,
                entity_type="task",
                entity_id=task.id,
                action="update",
                actor_id=user_id,
                changes=changes,
            )

        return task

    async def assign_task(
        self,
        task_id: uuid.UUID,
        organization_id: uuid.UUID,
        assigned_to_id: uuid.UUID,
        assigned_by_id: uuid.UUID,
    ) -> Task:
        """Assign task to a user."""
        return await self.update_task(
            task_id=task_id,
            organization_id=organization_id,
            user_id=assigned_by_id,
            assigned_to_id=assigned_to_id,
        )

    async def complete_task(
        self,
        task_id: uuid.UUID,
        organization_id: uuid.UUID,
        completed_by_id: uuid.UUID,
        completion_data: Optional[Dict[str, Any]] = None,
    ) -> Task:
        """Complete a task."""
        stmt = select(Task).where(
            and_(
                Task.id == task_id,
                Task.organization_id == organization_id,
                Task.deleted_at.is_(None),
            )
        )
        result = await self.db.execute(stmt)
        task = result.scalar_one_or_none()

        if not task:
            raise ValueError(f"Task {task_id} not found")

        if task.status == TaskStatus.COMPLETED:
            raise ValueError(f"Task {task_id} is already completed")

        task.status = TaskStatus.COMPLETED
        task.completed_at = datetime.now(timezone.utc)
        await self.db.flush()

        await self.audit.log(
            organization_id=organization_id,
            entity_type="task",
            entity_id=task.id,
            action="complete",
            actor_id=completed_by_id,
            changes={
                "status": TaskStatus.COMPLETED.value,
                "completed_at": str(task.completed_at),
                "completion_data": completion_data,
            },
        )

        return task

    async def cancel_task(
        self,
        task_id: uuid.UUID,
        organization_id: uuid.UUID,
        cancelled_by_id: uuid.UUID,
        reason: Optional[str] = None,
    ) -> Task:
        """Cancel a task."""
        return await self.update_task(
            task_id=task_id,
            organization_id=organization_id,
            user_id=cancelled_by_id,
            status=TaskStatus.CANCELLED,
            description=f"{reason}\n\n{await self._get_task_description(task_id)}" if reason else None,
        )

    async def _get_task_description(self, task_id: uuid.UUID) -> str:
        """Get current task description."""
        stmt = select(Task.description).where(Task.id == task_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none() or ""

    async def get_tasks_for_organization(
        self,
        organization_id: uuid.UUID,
        status: Optional[TaskStatus] = None,
        task_type: Optional[TaskType] = None,
        assigned_to_id: Optional[uuid.UUID] = None,
        due_date: Optional[str] = None,
        related_entity_id: Optional[uuid.UUID] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[Task]:
        """Get tasks for an organization with filters."""
        conditions = [
            Task.organization_id == organization_id,
            Task.deleted_at.is_(None),
        ]

        if status:
            conditions.append(Task.status == status)
        if task_type:
            conditions.append(Task.type == task_type)
        if assigned_to_id:
            conditions.append(Task.assigned_to_id == assigned_to_id)
        if due_date:
            # Filter by due date (day only, ignore time)
            conditions.append(
                and_(
                    Task.due_at >= datetime.fromisoformat(due_date),
                    Task.due_at < datetime.fromisoformat(due_date).replace(hour=23, minute=59, second=59)
                )
            )
        if related_entity_id:
            conditions.append(Task.related_entity_id == related_entity_id)

        stmt = (
            select(Task)
            .where(and_(*conditions))
            .order_by(Task.due_at.asc().nullslast(), Task.created_at.desc())
            .offset(skip)
            .limit(limit)
        )

        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_task_by_id(
        self,
        task_id: uuid.UUID,
        organization_id: uuid.UUID,
    ) -> Optional[Task]:
        """Get a single task by ID."""
        stmt = select(Task).where(
            and_(
                Task.id == task_id,
                Task.organization_id == organization_id,
                Task.deleted_at.is_(None),
            )
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
