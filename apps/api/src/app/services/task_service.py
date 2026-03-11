from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload
from typing import List, Optional, Dict, Any, Tuple
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
        created_by_id: Optional[uuid.UUID],
        title: str,
        description: Optional[str] = None,
        task_type: TaskType = TaskType.GENERAL,
        priority: TaskPriority = TaskPriority.MEDIUM,
        assigned_to_id: Optional[uuid.UUID] = None,
        due_at: Optional[datetime] = None,
        task_metadata: Optional[Dict[str, Any]] = None,
        related_entity_type: Optional[str] = None,
        related_entity_id: Optional[uuid.UUID] = None,
        linked_inventory_item_id: Optional[uuid.UUID] = None,
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
            linked_inventory_item_id=linked_inventory_item_id,
        )
        self.db.add(task)
        await self.db.flush()

        await self.audit.log_action(
            organization_id=organization_id,
            actor_user_id=created_by_id,
            action="create",
            entity_type="task",
            entity_id=task.id,
            after={
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
        **updates,
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
            await self.db.refresh(task)
            await self.audit.log_action(
                organization_id=organization_id,
                actor_user_id=user_id,
                action="update",
                entity_type="task",
                entity_id=task.id,
                after=changes,
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
    ) -> Tuple[Task, List[Dict[str, Any]]]:
        """Complete a task. Returns (task, inventory_deductions).

        If the task has linked_inventory_item_id and quantity_to_deduct_g in metadata,
        automatically deducts from inventory using FIFO.
        """
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

        # Handle inventory deduction if task has linked inventory item
        inventory_deductions: List[Dict[str, Any]] = []
        if task.linked_inventory_item_id:
            quantity_to_deduct_g = (task.task_metadata or {}).get("quantity_to_deduct_g")
            if quantity_to_deduct_g is not None and float(quantity_to_deduct_g) > 0:
                from src.app.services.inventory_service import InventoryService
                inv_service = InventoryService(self.db)
                try:
                    inventory_deductions = await inv_service.deduct_for_task(
                        organization_id=organization_id,
                        item_id=task.linked_inventory_item_id,
                        amount_g=float(quantity_to_deduct_g),
                        task_id=task_id,
                        user_id=completed_by_id,
                    )
                except Exception as e:
                    # Log but don't fail task completion
                    print(f"Warning: Failed to deduct inventory for task {task_id}: {e}")

        await self.db.flush()

        await self.audit.log_action(
            organization_id=organization_id,
            actor_user_id=completed_by_id,
            action="complete",
            entity_type="task",
            entity_id=task.id,
            after={
                "status": TaskStatus.COMPLETED.value,
                "completed_at": str(task.completed_at),
                "completion_data": completion_data,
                "inventory_deducted": len(inventory_deductions) > 0,
            },
        )

        return task, inventory_deductions

    async def cancel_task(
        self,
        task_id: uuid.UUID,
        organization_id: uuid.UUID,
        cancelled_by_id: uuid.UUID,
        reason: Optional[str] = None,
    ) -> Task:
        """Cancel a task."""
        description = None
        if reason:
            existing = await self._get_task_description(task_id)
            description = f"{reason}\n\n{existing}" if existing else reason
        return await self.update_task(
            task_id=task_id,
            organization_id=organization_id,
            user_id=cancelled_by_id,
            status=TaskStatus.CANCELLED,
            description=description,
        )

    async def _get_task_description(self, task_id: uuid.UUID) -> str:
        """Get current task description."""
        stmt = select(Task.description).where(Task.id == task_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none() or ""

    async def get_tasks_for_organization(
        self,
        organization_id: uuid.UUID,
        status: Optional[str] = None,
        task_type: Optional[TaskType] = None,
        assigned_to_id: Optional[uuid.UUID] = None,
        due_date: Optional[str] = None,
        related_entity_id: Optional[uuid.UUID] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> Tuple[List[Task], int]:
        """Get tasks for an organization with filters. Returns (tasks, total_count)."""
        conditions = [
            Task.organization_id == organization_id,
            Task.deleted_at.is_(None),
        ]

        if status == "active":
            conditions.append(
                Task.status.in_([TaskStatus.PENDING, TaskStatus.IN_PROGRESS])
            )
        elif status:
            try:
                conditions.append(Task.status == TaskStatus(status))
            except ValueError:
                pass  # Ignore invalid status values
        if task_type:
            conditions.append(Task.type == task_type)
        if assigned_to_id:
            conditions.append(Task.assigned_to_id == assigned_to_id)
        if due_date:
            # Filter by due date (day only, ignore time)
            conditions.append(
                and_(
                    Task.due_at >= datetime.fromisoformat(due_date),
                    Task.due_at
                    < datetime.fromisoformat(due_date).replace(
                        hour=23, minute=59, second=59
                    ),
                )
            )
        if related_entity_id:
            conditions.append(Task.related_entity_id == related_entity_id)

        where_clause = and_(*conditions)

        # Count query
        count_stmt = select(func.count()).select_from(Task).where(where_clause)
        count_result = await self.db.execute(count_stmt)
        total = count_result.scalar_one()

        # Data query with eager loading of creator
        stmt = (
            select(Task)
            .options(selectinload(Task.created_by))
            .where(where_clause)
            .order_by(Task.due_at.asc().nullslast(), Task.created_at.desc())
            .offset(skip)
            .limit(limit)
        )

        result = await self.db.execute(stmt)
        return result.scalars().all(), total

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
