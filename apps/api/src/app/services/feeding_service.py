"""Feeding service for managing feeding plans and logs."""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, update
from sqlalchemy.orm import selectinload
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timezone, timedelta
import uuid

from src.app.models.feeding_plan import FeedingPlan
from src.app.models.feeding_log import FeedingLog
from src.app.models.food import Food
from src.app.models.task import Task, TaskType, TaskStatus, TaskPriority
from src.app.services.audit_service import AuditService
from src.app.core.config import settings


class FeedingService:
    def __init__(self, db: AsyncSession, audit_service: Optional[AuditService] = None):
        self.db = db
        self.audit = audit_service or AuditService(db)

    # -------------------------------------------------------------------------
    # Plan management
    # -------------------------------------------------------------------------

    async def create_feeding_plan(
        self,
        organization_id: uuid.UUID,
        animal_id: uuid.UUID,
        start_date: date,
        created_by_id: uuid.UUID,
        food_id: Optional[uuid.UUID] = None,
        inventory_item_id: Optional[uuid.UUID] = None,
        amount_g: Optional[float] = None,
        amount_text: Optional[str] = None,
        times_per_day: Optional[int] = None,
        schedule_json: Optional[Dict[str, Any]] = None,
        end_date: Optional[date] = None,
        notes: Optional[str] = None,
        mer_calculation: Optional[Dict[str, Any]] = None,
    ) -> tuple[FeedingPlan, int]:
        """Create a new feeding plan for an animal. Returns (plan, n_closed_plans)."""
        today = date.today()

        # Auto-close overlapping active plans for this animal
        overlap_stmt = select(FeedingPlan).where(
            FeedingPlan.animal_id == animal_id,
            FeedingPlan.organization_id == organization_id,
            FeedingPlan.is_active == True,
            (FeedingPlan.end_date.is_(None)) | (FeedingPlan.end_date >= start_date),
        )
        overlapping = (await self.db.execute(overlap_stmt)).scalars().all()
        auto_close_date = start_date - timedelta(days=1)
        n_closed = 0
        for old_plan in overlapping:
            old_plan.end_date = auto_close_date
            if auto_close_date < today:
                old_plan.is_active = False
            n_closed += 1
            # Recalculate future tasks for the old plan now that it has an end date
            await self.recalculate_future_tasks(old_plan, organization_id)
        if n_closed:
            await self.db.flush()

        plan = FeedingPlan(
            id=uuid.uuid4(),
            organization_id=organization_id,
            animal_id=animal_id,
            food_id=food_id,
            inventory_item_id=inventory_item_id,
            amount_g=amount_g,
            amount_text=amount_text,
            times_per_day=times_per_day,
            schedule_json=schedule_json,
            start_date=start_date,
            end_date=end_date,
            notes=notes,
            is_active=True,
            mer_calculation=mer_calculation,
        )
        self.db.add(plan)
        await self.db.flush()

        await self.audit.log_action(
            organization_id=organization_id,
            actor_user_id=created_by_id,
            action="create",
            entity_type="feeding_plan",
            entity_id=plan.id,
            after={
                "animal_id": str(animal_id),
                "food_id": str(food_id) if food_id else None,
                "start_date": str(start_date),
            },
        )

        return plan, n_closed

    async def update_feeding_plan(
        self,
        plan_id: uuid.UUID,
        organization_id: uuid.UUID,
        user_id: uuid.UUID,
        **updates,
    ) -> FeedingPlan:
        """Update a feeding plan."""
        stmt = select(FeedingPlan).where(
            and_(
                FeedingPlan.id == plan_id,
                FeedingPlan.organization_id == organization_id,
            )
        )
        result = await self.db.execute(stmt)
        plan = result.scalar_one_or_none()

        if not plan:
            raise ValueError(f"Feeding plan {plan_id} not found")

        changes = {}
        for key, value in updates.items():
            if hasattr(plan, key) and getattr(plan, key) != value:
                old_value = getattr(plan, key)
                setattr(plan, key, value)
                changes[key] = {"old": str(old_value), "new": str(value)}

        if changes:
            await self.db.flush()
            await self.audit.log_action(
                organization_id=organization_id,
                actor_user_id=user_id,
                action="update",
                entity_type="feeding_plan",
                entity_id=plan.id,
                after=changes,
            )

            # If schedule or dates changed, recalculate future pending tasks
            schedule_changed = any(
                k in changes for k in ("schedule_json", "amount_g", "start_date", "end_date")
            )
            if schedule_changed:
                await self.recalculate_future_tasks(plan, organization_id)
                # Generate any new task slots the updated plan may have added
                from_dt = datetime.now(timezone.utc)
                to_dt = from_dt + timedelta(hours=settings.FEEDING_TASK_HORIZON_HOURS)
                await self.ensure_feeding_tasks_window(organization_id, from_dt, to_dt)

        return plan

    async def deactivate_feeding_plan(
        self,
        plan_id: uuid.UUID,
        organization_id: uuid.UUID,
        user_id: uuid.UUID,
    ) -> FeedingPlan:
        """Deactivate a feeding plan."""
        return await self.update_feeding_plan(
            plan_id=plan_id,
            organization_id=organization_id,
            user_id=user_id,
            is_active=False,
        )

    # -------------------------------------------------------------------------
    # Task management
    # -------------------------------------------------------------------------

    async def recalculate_future_tasks(
        self,
        plan: FeedingPlan,
        organization_id: uuid.UUID,
    ) -> Dict[str, int]:
        """
        Smart recalculate future PENDING tasks for a plan after a plan change.

        Rules:
        - DONE (COMPLETED) tasks are NEVER modified.
        - Tasks with manually_modified=True are NEVER overwritten.
        - PENDING tasks whose scheduled_time still exists in the new plan → update amount_g.
        - PENDING tasks whose scheduled_time no longer exists in the new plan → CANCELLED.

        Returns dict with counts: {"updated": n, "cancelled": n}.
        """
        now = datetime.now(timezone.utc)

        # Load all future PENDING feeding tasks for this plan
        stmt = select(Task).where(
            and_(
                Task.organization_id == organization_id,
                Task.type == TaskType.FEEDING,
                Task.task_metadata["feeding_plan_id"].astext == str(plan.id),
                Task.status == TaskStatus.PENDING,
                Task.due_at > now,
                Task.deleted_at.is_(None),
            )
        )
        result = await self.db.execute(stmt)
        future_tasks = result.scalars().all()

        if not future_tasks:
            return {"updated": 0, "cancelled": 0}

        # Determine new meal slots from updated plan
        new_schedule = plan.schedule_json or {}
        new_times = new_schedule.get("times", [])
        new_amounts = new_schedule.get("amounts", [])

        # Build new amount per time slot
        new_amount_by_time: Dict[str, Optional[float]] = {}
        for idx, t in enumerate(new_times):
            if new_amounts and idx < len(new_amounts):
                new_amount_by_time[t] = float(new_amounts[idx])
            elif plan.amount_g and new_times:
                new_amount_by_time[t] = float(plan.amount_g) / len(new_times)
            else:
                new_amount_by_time[t] = None

        # Check plan end_date — tasks beyond end_date should be cancelled
        plan_end_dt: Optional[datetime] = None
        if plan.end_date:
            plan_end_dt = datetime(
                plan.end_date.year, plan.end_date.month, plan.end_date.day,
                23, 59, 59, tzinfo=timezone.utc
            )

        n_updated = 0
        n_cancelled = 0

        for task in future_tasks:
            # Never touch manually modified tasks
            if task.manually_modified:
                continue

            scheduled_time = (task.task_metadata or {}).get("scheduled_time")

            # Cancel if task is beyond new plan end_date
            if plan_end_dt and task.due_at > plan_end_dt:
                task.status = TaskStatus.CANCELLED
                n_cancelled += 1
                continue

            # Cancel if this time slot no longer exists in the new plan
            if scheduled_time not in new_amount_by_time:
                task.status = TaskStatus.CANCELLED
                n_cancelled += 1
                continue

            # Update amount_g in task metadata
            new_amount = new_amount_by_time[scheduled_time]
            task.task_metadata = {
                **(task.task_metadata or {}),
                "amount_g": new_amount,
            }
            n_updated += 1

        if future_tasks:
            await self.db.flush()

        return {"updated": n_updated, "cancelled": n_cancelled}

    async def cancel_future_tasks(
        self,
        animal_id: uuid.UUID,
        organization_id: uuid.UUID,
        from_dt: Optional[datetime] = None,
    ) -> int:
        """
        Cancel all future PENDING feeding tasks for an animal.
        Used when animal leaves the shelter.
        Returns number of cancelled tasks.
        """
        if from_dt is None:
            from_dt = datetime.now(timezone.utc)

        stmt = select(Task).where(
            and_(
                Task.organization_id == organization_id,
                Task.type == TaskType.FEEDING,
                Task.related_entity_id == animal_id,
                Task.status == TaskStatus.PENDING,
                Task.due_at > from_dt,
                Task.deleted_at.is_(None),
            )
        )
        result = await self.db.execute(stmt)
        tasks = result.scalars().all()

        for task in tasks:
            task.status = TaskStatus.CANCELLED

        if tasks:
            await self.db.flush()

        return len(tasks)

    async def ensure_feeding_tasks_window(
        self,
        organization_id: uuid.UUID,
        from_dt: datetime,
        to_dt: datetime,
    ) -> List[Task]:
        """
        Idempotently generate feeding tasks within the specified time window.

        Optimized: single query for existing tasks + batch insert (no per-task flush/audit).
        """
        # 1. Load all active plans with their animals
        stmt = (
            select(FeedingPlan)
            .where(
                and_(
                    FeedingPlan.organization_id == organization_id,
                    FeedingPlan.is_active == True,
                    FeedingPlan.schedule_json.isnot(None),
                )
            )
            .options(selectinload(FeedingPlan.animal))
        )
        result = await self.db.execute(stmt)
        plans = result.scalars().all()

        if not plans:
            return []

        # 2. Load all existing feeding tasks for this window in ONE query
        existing_stmt = select(Task.task_metadata, Task.due_at).where(
            and_(
                Task.organization_id == organization_id,
                Task.type == TaskType.FEEDING,
                Task.due_at >= from_dt,
                Task.due_at <= to_dt,
                Task.deleted_at.is_(None),
            )
        )
        existing_result = await self.db.execute(existing_stmt)
        existing_rows = existing_result.all()

        # Build a set of (feeding_plan_id, due_at) for O(1) lookup
        existing_keys: set[tuple[str, datetime]] = set()
        for metadata, due_at in existing_rows:
            if metadata and "feeding_plan_id" in metadata:
                existing_keys.add((metadata["feeding_plan_id"], due_at))

        # 3. Compute which tasks need to be created
        tasks_to_create: List[Task] = []
        current_date = from_dt.date()
        end_date = to_dt.date()

        while current_date <= end_date:
            for plan in plans:
                if plan.start_date > current_date:
                    continue
                if plan.end_date and plan.end_date < current_date:
                    continue

                schedule_times = (plan.schedule_json or {}).get("times", [])
                if not schedule_times:
                    continue

                amounts = (plan.schedule_json or {}).get("amounts", [])

                for idx, scheduled_time in enumerate(schedule_times):
                    try:
                        time_obj = datetime.strptime(scheduled_time, "%H:%M").time()
                    except ValueError:
                        continue

                    due_at = datetime.combine(current_date, time_obj, tzinfo=timezone.utc)

                    if due_at < from_dt or due_at > to_dt:
                        continue

                    # Idempotency check — pure Python, no DB query
                    if (str(plan.id), due_at) in existing_keys:
                        continue

                    if amounts and idx < len(amounts):
                        amount_g = float(amounts[idx])
                    elif plan.amount_g and schedule_times:
                        amount_g = float(plan.amount_g) / len(schedule_times)
                    else:
                        amount_g = None

                    animal_name = plan.animal.name if plan.animal else "zvíře"
                    task = Task(
                        id=uuid.uuid4(),
                        organization_id=organization_id,
                        created_by_id=None,
                        title=f"Krmení {animal_name}",
                        description=(
                            f"Krmení v {scheduled_time}. Množství: {amount_g}g"
                            if amount_g
                            else f"Krmení v {scheduled_time}"
                        ),
                        type=TaskType.FEEDING,
                        priority=TaskPriority.MEDIUM,
                        status=TaskStatus.PENDING,
                        due_at=due_at,
                        task_metadata={
                            "feeding_plan_id": str(plan.id),
                            "animal_id": str(plan.animal_id),
                            "scheduled_time": scheduled_time,
                            "amount_g": amount_g,
                            "inventory_item_id": (
                                str(plan.inventory_item_id)
                                if plan.inventory_item_id
                                else None
                            ),
                        },
                        related_entity_type="animal",
                        related_entity_id=plan.animal_id,
                    )
                    tasks_to_create.append(task)
                    # Track in-memory to avoid duplicates within this batch
                    existing_keys.add((str(plan.id), due_at))

            current_date += timedelta(days=1)

        # 4. Batch insert — one flush for all new tasks
        if tasks_to_create:
            self.db.add_all(tasks_to_create)
            await self.db.flush()

        return tasks_to_create

    # -------------------------------------------------------------------------
    # Feeding log
    # -------------------------------------------------------------------------

    async def get_active_plans_for_animal(
        self,
        animal_id: uuid.UUID,
        organization_id: uuid.UUID,
    ) -> List[FeedingPlan]:
        """Get all active feeding plans for an animal (current date)."""
        today = date.today()
        stmt = select(FeedingPlan).where(
            and_(
                FeedingPlan.animal_id == animal_id,
                FeedingPlan.organization_id == organization_id,
                FeedingPlan.is_active == True,
                FeedingPlan.start_date <= today,
                (FeedingPlan.end_date.is_(None)) | (FeedingPlan.end_date >= today),
            )
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def log_feeding(
        self,
        organization_id: uuid.UUID,
        animal_id: uuid.UUID,
        fed_by_user_id: uuid.UUID,
        amount_text: Optional[str] = None,
        notes: Optional[str] = None,
        auto_deduct_inventory: bool = True,
        amount_g_override: Optional[float] = None,
        inventory_item_id: Optional[uuid.UUID] = None,
    ) -> Dict[str, Any]:
        """Log that an animal was fed. Returns dict with feeding_log and deductions."""
        feeding_log = FeedingLog(
            id=uuid.uuid4(),
            organization_id=organization_id,
            animal_id=animal_id,
            fed_at=datetime.now(timezone.utc),
            fed_by_user_id=fed_by_user_id,
            amount_text=amount_text,
            notes=notes,
        )
        self.db.add(feeding_log)
        await self.db.flush()
        await self.db.refresh(feeding_log)

        deductions = []
        if auto_deduct_inventory:
            deduct_item_id = inventory_item_id
            deduct_amount = amount_g_override

            if deduct_item_id is None or deduct_amount is None:
                plans = await self.get_active_plans_for_animal(animal_id, organization_id)
                if plans:
                    plan = plans[0]
                    if deduct_item_id is None:
                        deduct_item_id = plan.inventory_item_id
                    if deduct_amount is None:
                        deduct_amount = float(plan.amount_g) if plan.amount_g else None

            if deduct_amount is not None:
                food_name_fallback: Optional[str] = None
                if deduct_item_id is None:
                    plans = await self.get_active_plans_for_animal(animal_id, organization_id)
                    if plans and plans[0].food_id:
                        food_result = await self.db.execute(
                            select(Food).where(Food.id == plans[0].food_id)
                        )
                        food = food_result.scalar_one_or_none()
                        if food:
                            food_name_fallback = food.name

                if deduct_item_id is not None or food_name_fallback is not None:
                    from src.app.services.inventory_service import InventoryService

                    inv_service = InventoryService(self.db)
                    try:
                        deductions = await inv_service.deduct_for_feeding(
                            organization_id=organization_id,
                            amount_g=deduct_amount,
                            feeding_log_id=feeding_log.id,
                            user_id=fed_by_user_id,
                            item_id=deduct_item_id,
                            food_name=food_name_fallback,
                        )
                    except Exception as e:
                        print(f"Warning: Failed to deduct inventory: {e}")

        await self.audit.log_action(
            organization_id=organization_id,
            actor_user_id=fed_by_user_id,
            action="create",
            entity_type="feeding_log",
            entity_id=feeding_log.id,
            after={
                "animal_id": str(animal_id),
                "fed_at": str(feeding_log.fed_at),
                "inventory_deducted": len(deductions) > 0,
            },
        )

        return {"feeding_log": feeding_log, "deductions": deductions}

    async def complete_feeding_task(
        self,
        task_id: uuid.UUID,
        organization_id: uuid.UUID,
        completed_by_user_id: uuid.UUID,
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Complete a feeding task — creates feeding log, deducts inventory.
        Returns dict with task, feeding_log, and deductions.
        """
        task_stmt = select(Task).where(
            and_(
                Task.id == task_id,
                Task.organization_id == organization_id,
                Task.type == TaskType.FEEDING,
            )
        )
        task_result = await self.db.execute(task_stmt)
        task = task_result.scalar_one_or_none()

        if not task:
            raise ValueError(f"Feeding task {task_id} not found")

        if task.status == TaskStatus.COMPLETED:
            raise ValueError(f"Task {task_id} is already completed")

        animal_id = (task.task_metadata or {}).get("animal_id") or task.related_entity_id
        if not animal_id:
            raise ValueError("Task does not have animal_id")

        amount_g_raw = (task.task_metadata or {}).get("amount_g")
        inv_item_id_str = (task.task_metadata or {}).get("inventory_item_id")

        log_result = await self.log_feeding(
            organization_id=organization_id,
            animal_id=uuid.UUID(animal_id) if isinstance(animal_id, str) else animal_id,
            fed_by_user_id=completed_by_user_id,
            notes=notes,
            amount_g_override=float(amount_g_raw) if amount_g_raw is not None else None,
            inventory_item_id=uuid.UUID(inv_item_id_str) if inv_item_id_str else None,
            auto_deduct_inventory=True,
        )
        feeding_log = log_result["feeding_log"]
        deductions = log_result.get("deductions", [])

        task.task_metadata = {
            **(task.task_metadata or {}),
            "feeding_log_id": str(feeding_log.id),
        }
        await self.db.flush()

        from src.app.services.task_service import TaskService

        task_service = TaskService(self.db)
        completed_task = await task_service.complete_task(
            task_id=task_id,
            organization_id=organization_id,
            completed_by_id=completed_by_user_id,
            completion_data={"feeding_log_id": str(feeding_log.id)},
        )

        return {
            "task": completed_task,
            "feeding_log": feeding_log,
            "deductions": deductions,
        }

    async def get_feeding_history(
        self,
        animal_id: uuid.UUID,
        organization_id: uuid.UUID,
        days: int = 30,
    ) -> List[FeedingLog]:
        """Get feeding history for an animal."""
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
        stmt = (
            select(FeedingLog)
            .where(
                and_(
                    FeedingLog.animal_id == animal_id,
                    FeedingLog.organization_id == organization_id,
                    FeedingLog.fed_at >= cutoff_date,
                )
            )
            .order_by(FeedingLog.fed_at.desc())
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    # -------------------------------------------------------------------------
    # Legacy (kept for compatibility)
    # -------------------------------------------------------------------------

    async def generate_feeding_tasks_for_schedule(
        self,
        organization_id: uuid.UUID,
        current_time: datetime,
        days_ahead: int = 2,
    ) -> List[Task]:
        """Legacy: generate tasks for today + days_ahead. Use ensure_feeding_tasks_window instead."""
        from_dt = current_time
        to_dt = current_time + timedelta(days=days_ahead)
        return await self.ensure_feeding_tasks_window(organization_id, from_dt, to_dt)
