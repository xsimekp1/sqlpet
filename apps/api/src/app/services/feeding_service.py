"""Feeding service for managing feeding plans and logs."""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, delete
from sqlalchemy.orm import selectinload
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timezone, timedelta
import uuid

from src.app.models.feeding_plan import FeedingPlan
from src.app.models.feeding_log import FeedingLog
from src.app.models.food import Food
from src.app.models.task import Task, TaskType, TaskStatus
from src.app.services.audit_service import AuditService
from src.app.core.config import settings


class FeedingService:
    def __init__(self, db: AsyncSession, audit_service: Optional[AuditService] = None):
        self.db = db
        self.audit = audit_service or AuditService(db)

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

            # If schedule changed, delete future pending tasks and regenerate
            if (
                "schedule_json" in updates
                or "start_date" in updates
                or "end_date" in updates
            ):
                await self._delete_future_pending_tasks(plan_id, organization_id)

                from_dt = datetime.now(timezone.utc)
                to_dt = from_dt + timedelta(hours=settings.FEEDING_TASK_HORIZON_HOURS)
                await self.ensure_feeding_tasks_window(organization_id, from_dt, to_dt)

        return plan

    async def _delete_future_pending_tasks(
        self,
        plan_id: uuid.UUID,
        organization_id: uuid.UUID,
    ) -> int:
        """Delete pending feeding tasks for plan where due_at > now."""
        stmt = delete(Task).where(
            and_(
                Task.organization_id == organization_id,
                Task.type == TaskType.FEEDING,
                Task.task_metadata["feeding_plan_id"].astext == str(plan_id),
                Task.status == TaskStatus.PENDING,
                Task.due_at > datetime.now(timezone.utc),
            )
        )
        result = await self.db.execute(stmt)
        return result.rowcount

    async def ensure_feeding_tasks_window(
        self,
        organization_id: uuid.UUID,
        from_dt: datetime,
        to_dt: datetime,
    ) -> List[Task]:
        """
        Generate feeding tasks within specified window. Idempotent.

        Algorithm:
        1. Load active feeding plans with schedule_json
        2. For each plan:
           - Skip if not active in [from_dt, to_dt] (check start_date/end_date)
           - For each day in window:
             - For each time in schedule_json["times"]:
               - Check if task already exists (leverages unique constraint)
               - If not, create Task with:
                 - type=FEEDING
                 - due_at = date + time
                 - task_metadata = {
                     "feeding_plan_id": str(plan_id),
                     "animal_id": str(plan.animal_id),
                     "scheduled_time": time,
                     "amount_g": amounts[index] if amounts else plan.amount_g / len(times)
                   }
                 - related_entity_type="animal", related_entity_id=plan.animal_id
        3. Return created tasks
        """
        from src.app.services.task_service import TaskService

        task_service = TaskService(self.db)

        tasks_created = []

        # Get all active feeding plans with schedules
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

        # Iterate through each day in the window
        current_date = from_dt.date()
        end_date = to_dt.date()

        while current_date <= end_date:
            for plan in plans:
                # Skip if plan is not active on this date
                if plan.start_date > current_date:
                    continue
                if plan.end_date and plan.end_date < current_date:
                    continue

                if not plan.schedule_json:
                    continue

                # Check if schedule has times array
                schedule_times = plan.schedule_json.get("times", [])
                if not schedule_times:
                    continue

                # Get amounts array (if provided)
                amounts = plan.schedule_json.get("amounts", [])

                for idx, scheduled_time in enumerate(schedule_times):
                    # Parse time
                    try:
                        time_obj = datetime.strptime(scheduled_time, "%H:%M").time()
                    except ValueError:
                        continue  # Skip invalid time format

                    # Construct due_at datetime
                    due_at = datetime.combine(current_date, time_obj)
                    # Make timezone-aware
                    due_at = due_at.replace(tzinfo=timezone.utc)

                    # Skip if due_at is outside window
                    if due_at < from_dt or due_at > to_dt:
                        continue

                    # Calculate amount for this feeding
                    if amounts and idx < len(amounts):
                        amount_g = amounts[idx]
                    elif plan.amount_g and len(schedule_times) > 0:
                        amount_g = plan.amount_g / len(schedule_times)
                    else:
                        amount_g = None

                    # Check if task already exists (leverage unique constraint)
                    existing_task_stmt = select(Task).where(
                        and_(
                            Task.organization_id == organization_id,
                            Task.type == TaskType.FEEDING,
                            Task.related_entity_id == plan.animal_id,
                            Task.task_metadata["feeding_plan_id"].astext
                            == str(plan.id),
                            Task.due_at == due_at,
                            Task.deleted_at.is_(None),
                        )
                    )
                    existing_result = await self.db.execute(existing_task_stmt)
                    existing_task = existing_result.scalar_one_or_none()

                    if existing_task:
                        # Task already exists, skip
                        continue

                    # Create feeding task
                    try:
                        animal_name = plan.animal.name if plan.animal else "zvíře"
                        task = await task_service.create_task(
                            organization_id=organization_id,
                            created_by_id=None,  # System-generated feeding task
                            title=f"Krmení {animal_name}",
                            description=f"Krmení v {scheduled_time}. Množství: {amount_g}g"
                            if amount_g
                            else f"Krmení v {scheduled_time}",
                            task_type=TaskType.FEEDING,
                            due_at=due_at,
                            task_metadata={
                                "feeding_plan_id": str(plan.id),
                                "animal_id": str(plan.animal_id),
                                "scheduled_time": scheduled_time,
                                "amount_g": amount_g,
                                "inventory_item_id": str(plan.inventory_item_id) if plan.inventory_item_id else None,
                            },
                            related_entity_type="animal",
                            related_entity_id=plan.animal_id,
                        )
                        tasks_created.append(task)
                    except Exception as e:
                        # If unique constraint violation, skip (task already exists)
                        if "uq_feeding_task_window" in str(e):
                            continue
                        raise

            current_date += timedelta(days=1)

        return tasks_created

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

    async def get_active_plans_for_animal(
        self,
        animal_id: uuid.UUID,
        organization_id: uuid.UUID,
    ) -> List[FeedingPlan]:
        """Get all active feeding plans for an animal."""
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
        # Refresh to populate server-side defaults (e.g. created_at)
        await self.db.refresh(feeding_log)

        # Auto-deduct from inventory if enabled
        deductions = []
        if auto_deduct_inventory:
            # Resolve item ID and amount to deduct
            deduct_item_id = inventory_item_id
            deduct_amount = amount_g_override

            if deduct_item_id is None or deduct_amount is None:
                # Fall back to active feeding plan
                plans = await self.get_active_plans_for_animal(animal_id, organization_id)
                if plans:
                    plan = plans[0]
                    if deduct_item_id is None:
                        deduct_item_id = plan.inventory_item_id
                    if deduct_amount is None:
                        deduct_amount = float(plan.amount_g) if plan.amount_g else None

            # Only deduct when we have an amount to deduct
            if deduct_amount is not None:
                # Resolve food_name fallback for name-based lookup (legacy plans without inventory_item_id)
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
                        # Log error but don't fail the feeding log
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

    async def generate_feeding_tasks_for_schedule(
        self,
        organization_id: uuid.UUID,
        current_time: datetime,
        days_ahead: int = 2,
    ) -> List[Task]:
        """
        Generate feeding tasks for all active feeding plans.
        Generates tasks for today + days_ahead (default 2 days).
        """
        from src.app.services.task_service import TaskService

        task_service = TaskService(self.db)

        tasks_created = []
        today = current_time.date()

        # Get all active feeding plans with schedules
        stmt = (
            select(FeedingPlan)
            .where(
                and_(
                    FeedingPlan.organization_id == organization_id,
                    FeedingPlan.is_active == True,
                    FeedingPlan.start_date <= today + timedelta(days=days_ahead),
                    (FeedingPlan.end_date.is_(None)) | (FeedingPlan.end_date >= today),
                    FeedingPlan.schedule_json.isnot(None),
                )
            )
            .options(selectinload(FeedingPlan.animal))
        )
        result = await self.db.execute(stmt)
        plans = result.scalars().all()

        # Generate tasks for each day from today to today + days_ahead
        for day_offset in range(days_ahead + 1):
            target_date = today + timedelta(days=day_offset)

            for plan in plans:
                if not plan.schedule_json:
                    continue

                # Check if plan is active on target date
                if plan.start_date > target_date:
                    continue
                if plan.end_date and plan.end_date < target_date:
                    continue

                # Check if schedule has times array
                schedule_times = plan.schedule_json.get("times", [])
                if not schedule_times:
                    continue

                for scheduled_time in schedule_times:
                    # Check if task already exists for this animal + time + date
                    existing_task_stmt = select(Task).where(
                        and_(
                            Task.organization_id == organization_id,
                            Task.type == TaskType.FEEDING,
                            Task.related_entity_type == "animal",
                            Task.related_entity_id == plan.animal_id,
                            func.date(Task.due_at) == target_date,
                            Task.task_metadata["scheduled_time"].astext
                            == scheduled_time,
                            Task.status != TaskStatus.CANCELLED,
                        )
                    )
                    existing_result = await self.db.execute(existing_task_stmt)
                    existing_task = existing_result.scalar_one_or_none()

                    if existing_task:
                        continue

                    # Calculate per-meal amount from schedule
                    schedule_amounts = plan.schedule_json.get("amounts", [])
                    meal_idx = schedule_times.index(scheduled_time)
                    if schedule_amounts and meal_idx < len(schedule_amounts):
                        meal_amount_g = schedule_amounts[meal_idx]
                    elif plan.amount_g and len(schedule_times) > 0:
                        meal_amount_g = plan.amount_g / len(schedule_times)
                    else:
                        meal_amount_g = None

                    # Create feeding task
                    animal_name = plan.animal.name if plan.animal else "zvíře"
                    task = await task_service.create_task(
                        organization_id=organization_id,
                        created_by_id=None,  # System-generated
                        title=f"Nakrmit {animal_name}",
                        description=f"Scheduled feeding at {scheduled_time}. Amount: {plan.amount_text or f'{plan.amount_g}g'}",
                        task_type=TaskType.FEEDING,
                        due_at=datetime.combine(
                            target_date,
                            datetime.strptime(scheduled_time, "%H:%M").time(),
                        ),
                        task_metadata={
                            "feeding_plan_id": str(plan.id),
                            "animal_id": str(plan.animal_id),
                            "scheduled_time": scheduled_time,
                            "amount_g": meal_amount_g,
                            "inventory_item_id": str(plan.inventory_item_id) if plan.inventory_item_id else None,
                        },
                        related_entity_type="animal",
                        related_entity_id=plan.animal_id,
                    )
                    tasks_created.append(task)

        return tasks_created

    async def complete_feeding_task(
        self,
        task_id: uuid.UUID,
        organization_id: uuid.UUID,
        completed_by_user_id: uuid.UUID,
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Complete a feeding task - creates feeding log and deducts inventory.
        Returns dict with task, feeding_log, and inventory_transaction.
        """
        # Get task
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

        # Extract animal_id from task metadata
        animal_id = task.task_metadata.get("animal_id") if task.task_metadata else None
        if not animal_id:
            animal_id = task.related_entity_id

        if not animal_id:
            raise ValueError("Task does not have animal_id")

        # Extract per-meal amount and inventory item from task metadata
        amount_g_raw = task.task_metadata.get("amount_g") if task.task_metadata else None
        inv_item_id_str = task.task_metadata.get("inventory_item_id") if task.task_metadata else None

        # Log feeding
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

        # Persist feeding_log_id into task metadata for later retrieval
        task.task_metadata = {
            **(task.task_metadata or {}),
            "feeding_log_id": str(feeding_log.id),
        }
        await self.db.flush()

        # Mark task as completed
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
        from datetime import timedelta

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
