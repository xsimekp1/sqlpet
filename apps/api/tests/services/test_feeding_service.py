"""Unit tests for FeedingService"""

import uuid
import pytest
from datetime import datetime, timezone, date, timedelta
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.services.feeding_service import FeedingService
from src.app.models.feeding_plan import FeedingPlan
from src.app.models.feeding_log import FeedingLog
from src.app.models.food import Food, FoodType
from src.app.models.animal import Animal
from src.app.models.user import User
from src.app.models.organization import Organization
from src.app.models.task import Task, TaskType, TaskStatus


@pytest.fixture
def mock_db():
    """Mock database session"""
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def mock_audit():
    """Mock audit service"""
    audit = MagicMock()
    audit.log_action = AsyncMock()
    return audit


@pytest.fixture
def feeding_service(mock_db, mock_audit):
    """Create FeedingService instance with mocks"""
    service = FeedingService(mock_db)
    service.audit = mock_audit
    return service


@pytest.fixture
def sample_org():
    """Sample organization"""
    return Organization(id=uuid4(), name="Test Shelter", slug="test-shelter")


@pytest.fixture
def sample_user(sample_org):
    """Sample user"""
    return User(
        id=uuid4(),
        email="test@example.com",
        name="Test User",
    )


@pytest.fixture
def sample_food(sample_org):
    """Sample food"""
    return Food(
        id=uuid4(),
        name="Premium Dog Food",
        brand="Royal Canin",
        type=FoodType.DRY,
        kcal_per_100g=380,
    )


@pytest.fixture
def sample_animal(sample_org):
    """Sample animal"""
    return Animal(id=uuid4(), name="Max", public_code="A001", species="dog")


@pytest.fixture
def sample_feeding_plan(sample_org, sample_animal, sample_food):
    """Sample feeding plan"""
    return FeedingPlan(
        id=uuid4(),
        organization_id=sample_org.id,
        animal_id=sample_animal.id,
        food_id=sample_food.id,
        amount_g=200,
        times_per_day=2,
        schedule_json={"times": ["08:00", "18:00"]},
        start_date=date.today(),
        is_active=True,
    )


class TestFeedingService:
    """Test FeedingService methods"""

    @pytest.mark.asyncio
    async def test_create_feeding_plan(
        self,
        feeding_service,
        mock_db,
        mock_audit,
        sample_org,
        sample_user,
        sample_animal,
        sample_food,
    ):
        """Test creating a feeding plan"""
        # Act
        result = await feeding_service.create_feeding_plan(
            organization_id=sample_org.id,
            animal_id=sample_animal.id,
            start_date=date.today(),
            created_by_id=sample_user.id,
            food_id=sample_food.id,
            amount_g=200,
            times_per_day=2,
            schedule_json=["08:00", "18:00"],
        )

        # Assert
        assert result.animal_id == sample_animal.id
        assert result.food_id == sample_food.id
        assert result.amount_g == 200
        assert result.is_active is True
        mock_db.add.assert_called_once()
        mock_db.flush.assert_called_once()
        mock_audit.log_action.assert_called_once()

    @pytest.mark.asyncio
    async def test_log_feeding_without_inventory_deduction(
        self,
        feeding_service,
        mock_db,
        mock_audit,
        sample_org,
        sample_animal,
        sample_user,
    ):
        """Test logging feeding without automatic inventory deduction"""
        # Act
        result = await feeding_service.log_feeding(
            organization_id=sample_org.id,
            animal_id=sample_animal.id,
            fed_by_user_id=sample_user.id,
            amount_text="1 cup",
            notes="Fed normally",
            auto_deduct_inventory=False,
        )

        # Assert
        assert result["feeding_log"].animal_id == sample_animal.id
        assert result["feeding_log"].fed_by_user_id == sample_user.id
        assert result["feeding_log"].amount_text == "1 cup"
        assert result["deductions"] == []
        mock_db.add.assert_called_once()
        mock_db.flush.assert_called_once()
        mock_audit.log_action.assert_called_once()

    @pytest.mark.asyncio
    async def test_log_feeding_with_inventory_deduction(
        self,
        feeding_service,
        mock_db,
        mock_audit,
        sample_org,
        sample_animal,
        sample_user,
        sample_food,
        sample_feeding_plan,
    ):
        """Test logging feeding with automatic inventory deduction"""
        # Arrange
        # Mock finding active feeding plan
        mock_plan_result = MagicMock()
        mock_plan_result.scalars.return_value.all.return_value = [sample_feeding_plan]

        # Mock finding food
        mock_food_result = MagicMock()
        mock_food_result.scalar_one_or_none.return_value = sample_food

        async def mock_execute(query):
            query_str = str(query)
            if "feeding_plans" in query_str.lower():
                return mock_plan_result
            elif "foods" in query_str.lower():
                return mock_food_result
            return MagicMock()

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        # Mock InventoryService
        with patch(
            "src.app.services.inventory_service.InventoryService"
        ) as MockInventoryService:
            mock_inv_service = AsyncMock()
            mock_inv_service.deduct_for_feeding = AsyncMock(
                return_value=[{
                    "lot": MagicMock(),
                    "lot_id": uuid4(),
                    "lot_number": "LOT-001",
                    "quantity_deducted": 0.2,
                    "cost_per_unit": None,
                    "lot_emptied": False,
                    "transaction": MagicMock(),
                }]
            )
            MockInventoryService.return_value = mock_inv_service

            # Act
            result = await feeding_service.log_feeding(
                organization_id=sample_org.id,
                animal_id=sample_animal.id,
                fed_by_user_id=sample_user.id,
                amount_text="200g",
                auto_deduct_inventory=True,
            )

            # Assert
            assert result["feeding_log"].animal_id == sample_animal.id
            mock_inv_service.deduct_for_feeding.assert_called_once()
            call_args = mock_inv_service.deduct_for_feeding.call_args
            assert call_args[1]["food_name"] == sample_food.name
            assert call_args[1]["amount_g"] == 200

    @pytest.mark.asyncio
    async def test_deactivate_feeding_plan(
        self,
        feeding_service,
        mock_db,
        mock_audit,
        sample_org,
        sample_user,
        sample_feeding_plan,
    ):
        """Test deactivating a feeding plan"""
        # Arrange
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_feeding_plan
        mock_db.execute = AsyncMock(return_value=mock_result)

        # Act
        result = await feeding_service.deactivate_feeding_plan(
            plan_id=sample_feeding_plan.id,
            organization_id=sample_org.id,
            user_id=sample_user.id,
        )

        # Assert
        assert result.is_active is False
        mock_db.flush.assert_called_once()
        mock_audit.log_action.assert_called_once()

    @pytest.mark.asyncio
    async def test_complete_feeding_task(
        self, feeding_service, mock_db, sample_org, sample_animal, sample_user
    ):
        """Test completing a feeding task via task_id"""
        task_id = uuid4()

        # Create a task with feeding metadata
        task = Task(
            id=task_id,
            organization_id=sample_org.id,
            created_by_id=sample_user.id,
            type=TaskType.FEEDING,
            status=TaskStatus.PENDING,
            title="Feed animal",
            task_metadata={"animal_id": str(sample_animal.id)},
        )

        # Mock DB to return the task
        mock_task_result = MagicMock()
        mock_task_result.scalar_one_or_none.return_value = task
        mock_db.execute = AsyncMock(return_value=mock_task_result)

        mock_feeding_log = MagicMock(id=uuid4(), animal_id=sample_animal.id)
        mock_completed_task = MagicMock(status=TaskStatus.COMPLETED)

        with patch.object(feeding_service, "log_feeding") as mock_log_feeding:
            mock_log_feeding.return_value = {"feeding_log": mock_feeding_log, "deductions": []}

            with patch("src.app.services.task_service.TaskService") as MockTaskService:
                mock_task_svc = AsyncMock()
                mock_task_svc.complete_task = AsyncMock(
                    return_value=mock_completed_task
                )
                MockTaskService.return_value = mock_task_svc

                result = await feeding_service.complete_feeding_task(
                    task_id=task_id,
                    organization_id=sample_org.id,
                    completed_by_user_id=sample_user.id,
                    notes="Task completed",
                )

        assert result["feeding_log"] == mock_feeding_log
        assert result["deductions"] == []
        mock_log_feeding.assert_called_once()
        call_args = mock_log_feeding.call_args
        assert call_args[1]["animal_id"] == uuid.UUID(str(sample_animal.id))
        assert call_args[1]["auto_deduct_inventory"] is True

    @pytest.mark.asyncio
    async def test_update_feeding_plan(
        self,
        feeding_service,
        mock_db,
        mock_audit,
        sample_org,
        sample_user,
        sample_feeding_plan,
    ):
        """Test updating a feeding plan"""
        # Arrange
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_feeding_plan
        mock_db.execute = AsyncMock(return_value=mock_result)

        # Act
        result = await feeding_service.update_feeding_plan(
            plan_id=sample_feeding_plan.id,
            organization_id=sample_org.id,
            user_id=sample_user.id,
            amount_g=300,
            notes="Increased amount",
        )

        # Assert
        assert result.amount_g == 300
        assert result.notes == "Increased amount"
        mock_db.flush.assert_called()
        mock_audit.log_action.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_feeding_plan_not_found(
        self, feeding_service, mock_db, sample_org, sample_user
    ):
        """Test updating non-existent feeding plan raises error"""
        # Arrange
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=mock_result)

        # Act & Assert
        with pytest.raises(ValueError, match="not found"):
            await feeding_service.update_feeding_plan(
                plan_id=uuid4(),
                organization_id=sample_org.id,
                user_id=sample_user.id,
                amount_g=300,
            )

    @pytest.mark.asyncio
    async def test_get_active_plans_for_animal(
        self, feeding_service, mock_db, sample_org, sample_animal, sample_feeding_plan
    ):
        """Test getting active feeding plans for an animal"""
        # Arrange
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [sample_feeding_plan]
        mock_db.execute = AsyncMock(return_value=mock_result)

        # Act
        result = await feeding_service.get_active_plans_for_animal(
            animal_id=sample_animal.id,
            organization_id=sample_org.id,
        )

        # Assert
        assert len(result) == 1
        assert result[0].id == sample_feeding_plan.id

    @pytest.mark.asyncio
    async def test_get_active_plans_for_animal_no_plans(
        self, feeding_service, mock_db, sample_org, sample_animal
    ):
        """Test getting active plans when none exist"""
        # Arrange
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute = AsyncMock(return_value=mock_result)

        # Act
        result = await feeding_service.get_active_plans_for_animal(
            animal_id=sample_animal.id,
            organization_id=sample_org.id,
        )

        # Assert
        assert len(result) == 0

    @pytest.mark.asyncio
    async def test_get_feeding_history(
        self, feeding_service, mock_db, sample_org, sample_animal, sample_user
    ):
        """Test getting feeding history for an animal"""
        # Arrange
        from datetime import datetime, timezone, timedelta

        feeding_log = FeedingLog(
            id=uuid4(),
            organization_id=sample_org.id,
            animal_id=sample_animal.id,
            fed_at=datetime.now(timezone.utc) - timedelta(days=1),
            fed_by_user_id=sample_user.id,
            amount_text="200g",
        )

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [feeding_log]
        mock_db.execute = AsyncMock(return_value=mock_result)

        # Act
        result = await feeding_service.get_feeding_history(
            animal_id=sample_animal.id,
            organization_id=sample_org.id,
            days=30,
        )
        # Assert
        assert len(result) == 1
        assert result[0].id == feeding_log.id

    # Tests for generate_feeding_tasks_for_schedule would require more complex mocking
    # due to model relationship loading issues. The core feeding functionality is
    # tested above - this is an edge case that can be tested separately.

    @pytest.mark.asyncio
    async def test_ensure_feeding_tasks_uses_none_as_creator(
        self,
        feeding_service,
        mock_db,
        mock_audit,
        sample_org,
        sample_feeding_plan,
    ):
        """
        Regression test: ensure_feeding_tasks_window must pass created_by_id=None
        to task_service.create_task(), NOT plan.organization_id.
        Previously, plan.organization_id (an org UUID) was passed as created_by_id
        (a FK to users table), causing a FK violation on production.
        """
        from datetime import datetime, timezone, timedelta
        from unittest.mock import patch, AsyncMock, MagicMock, call

        now = datetime.now(timezone.utc)
        from_dt = now
        to_dt = now + timedelta(hours=24)

        # Mock: return one active plan, no existing tasks
        call_count = 0

        async def mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                # First call: list active plans
                result.scalars.return_value.all.return_value = [sample_feeding_plan]
            else:
                # Subsequent calls: check existing tasks → none found
                result.scalar_one_or_none.return_value = None
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)
        mock_db.flush = AsyncMock()

        created_tasks = []

        async def fake_create_task(**kwargs):
            created_tasks.append(kwargs)
            t = Task(
                id=uuid4(),
                organization_id=kwargs['organization_id'],
                created_by_id=kwargs.get('created_by_id'),
                title=kwargs['title'],
                type=kwargs['task_type'],
                status=TaskStatus.PENDING,
            )
            mock_db.add(t)
            await mock_db.flush()
            return t

        with patch('src.app.services.task_service.TaskService') as MockTS:
            mock_ts_instance = MagicMock()
            mock_ts_instance.create_task = AsyncMock(side_effect=fake_create_task)
            MockTS.return_value = mock_ts_instance

            await feeding_service.ensure_feeding_tasks_window(
                organization_id=sample_org.id,
                from_dt=from_dt,
                to_dt=to_dt,
            )

        # The critical assertion: created_by_id must be None, never the org UUID
        for kwargs in created_tasks:
            assert kwargs.get('created_by_id') is None, (
                f"created_by_id should be None for system-generated feeding tasks, "
                f"got {kwargs.get('created_by_id')!r}. "
                f"Passing organization_id causes FK violation on users table."
            )


# ---------------------------------------------------------------------------
# Krmeničko epic — 15 unit tests
# ---------------------------------------------------------------------------

def _make_plan(org_id, *, amount_g=300, times=None, amounts=None, start=None, end_date=None, plan_id=None):
    """Helper: build a FeedingPlan with given params."""
    plan_id = plan_id or uuid4()
    animal_id = uuid4()
    schedule = {"times": times or ["08:00", "18:00"]}
    if amounts:
        schedule["amounts"] = amounts
    plan = FeedingPlan(
        id=plan_id,
        organization_id=org_id,
        animal_id=animal_id,
        amount_g=amount_g,
        schedule_json=schedule,
        start_date=start or date(2026, 3, 5),
        is_active=True,
    )
    plan.animal = MagicMock()
    plan.animal.name = "TestAnimal"
    return plan, plan_id, animal_id


def _make_pending_task(org_id, plan_id, animal_id, scheduled_time, due_at, amount_g, manually_modified=False):
    return Task(
        id=uuid4(),
        organization_id=org_id,
        type=TaskType.FEEDING,
        status=TaskStatus.PENDING,
        title=f"Feed {scheduled_time}",
        due_at=due_at,
        task_metadata={
            "feeding_plan_id": str(plan_id),
            "animal_id": str(animal_id),
            "scheduled_time": scheduled_time,
            "amount_g": amount_g,
        },
        manually_modified=manually_modified,
    )


def _mock_execute_for_window(plan, existing_task=None):
    """Return a side_effect fn: 1st call → plan list; subsequent → optional existing task."""
    call_count = 0

    async def _execute(stmt):
        nonlocal call_count
        call_count += 1
        result = MagicMock()
        if call_count == 1:
            result.scalars.return_value.all.return_value = [plan]
        else:
            result.scalar_one_or_none.return_value = existing_task
        return result

    return _execute


def _patch_task_service():
    """Return (patcher, created_tasks list). Patcher must be used as context manager."""
    created = []

    async def fake_create(**kwargs):
        t = Task(
            id=uuid4(),
            organization_id=kwargs["organization_id"],
            title=kwargs["title"],
            type=kwargs["task_type"],
            status=TaskStatus.PENDING,
            due_at=kwargs.get("due_at"),
            task_metadata=kwargs.get("task_metadata"),
        )
        created.append(t)
        return t

    return created, fake_create


class TestKrmenickoEpic:
    """15 unit tests for the krmeničko feeding-task generation epic."""

    # ------------------------------------------------------------------
    # 1. Basic generation — 300g / 2 meals → 150g each
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_basic_generation_splits_daily_amount_equally(
        self, feeding_service, mock_db, sample_org
    ):
        """300g / 2 meals: each generated task gets 150g."""
        plan, plan_id, animal_id = _make_plan(sample_org.id, amount_g=300, times=["08:00", "14:00"])

        from_dt = datetime(2026, 3, 5, 6, 0, 0, tzinfo=timezone.utc)
        to_dt = from_dt + timedelta(hours=12)

        mock_db.execute = AsyncMock(side_effect=_mock_execute_for_window(plan))
        mock_db.flush = AsyncMock()

        created, fake_create = _patch_task_service()
        with patch("src.app.services.task_service.TaskService") as MockTS:
            MockTS.return_value.create_task = AsyncMock(side_effect=fake_create)
            await feeding_service.ensure_feeding_tasks_window(
                organization_id=sample_org.id, from_dt=from_dt, to_dt=to_dt
            )

        assert len(created) == 2
        amounts = [t.task_metadata["amount_g"] for t in created]
        assert amounts == [150.0, 150.0]

    # ------------------------------------------------------------------
    # 2. Task generation window — max 12h ahead
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_generation_window_excludes_slots_beyond_horizon(
        self, feeding_service, mock_db, sample_org
    ):
        """Tasks scheduled after the 12h window boundary are not created."""
        # 3 slots: 12:00, 18:00, 23:00. Window is 10:00→22:00 — 23:00 is outside.
        plan, *_ = _make_plan(
            sample_org.id, amount_g=300, times=["12:00", "18:00", "23:00"]
        )

        from_dt = datetime(2026, 3, 5, 10, 0, 0, tzinfo=timezone.utc)
        to_dt = from_dt + timedelta(hours=12)  # 22:00

        mock_db.execute = AsyncMock(side_effect=_mock_execute_for_window(plan))
        mock_db.flush = AsyncMock()

        created, fake_create = _patch_task_service()
        with patch("src.app.services.task_service.TaskService") as MockTS:
            MockTS.return_value.create_task = AsyncMock(side_effect=fake_create)
            await feeding_service.ensure_feeding_tasks_window(
                organization_id=sample_org.id, from_dt=from_dt, to_dt=to_dt
            )

        assert len(created) == 2
        slot_times = {t.due_at.strftime("%H:%M") for t in created}
        assert "12:00" in slot_times
        assert "18:00" in slot_times
        assert "23:00" not in slot_times

    # ------------------------------------------------------------------
    # 3. Plan change — 300g→400g: future PENDING tasks updated
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_plan_change_updates_pending_task_amounts(
        self, feeding_service, mock_db, sample_org
    ):
        """After amount change 300g→400g/2meals, future PENDING tasks get 200g."""
        plan, plan_id, animal_id = _make_plan(
            sample_org.id, amount_g=400, times=["08:00", "18:00"]
        )
        now = datetime(2026, 3, 5, 10, 0, 0, tzinfo=timezone.utc)

        task1 = _make_pending_task(sample_org.id, plan_id, animal_id, "08:00", now + timedelta(hours=2), 150.0)
        task2 = _make_pending_task(sample_org.id, plan_id, animal_id, "18:00", now + timedelta(hours=8), 150.0)

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [task1, task2]
        mock_db.execute = AsyncMock(return_value=mock_result)
        mock_db.flush = AsyncMock()

        result = await feeding_service.recalculate_future_tasks(plan, sample_org.id)

        assert result == {"updated": 2, "cancelled": 0}
        assert task1.task_metadata["amount_g"] == 200.0
        assert task2.task_metadata["amount_g"] == 200.0
        mock_db.flush.assert_called_once()

    # ------------------------------------------------------------------
    # 4. Meal count change — 3 meals → 2 meals: extra task cancelled
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_meal_count_reduction_cancels_removed_time_slot(
        self, feeding_service, mock_db, sample_org
    ):
        """3 meals → 2 meals: task for the removed 13:00 slot is cancelled."""
        plan, plan_id, animal_id = _make_plan(
            sample_org.id, amount_g=300, times=["08:00", "18:00"]  # 13:00 removed
        )
        now = datetime(2026, 3, 5, 6, 0, 0, tzinfo=timezone.utc)

        task_08 = _make_pending_task(sample_org.id, plan_id, animal_id, "08:00", now + timedelta(hours=2), 100.0)
        task_13 = _make_pending_task(sample_org.id, plan_id, animal_id, "13:00", now + timedelta(hours=7), 100.0)
        task_18 = _make_pending_task(sample_org.id, plan_id, animal_id, "18:00", now + timedelta(hours=12), 100.0)

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [task_08, task_13, task_18]
        mock_db.execute = AsyncMock(return_value=mock_result)
        mock_db.flush = AsyncMock()

        result = await feeding_service.recalculate_future_tasks(plan, sample_org.id)

        assert result["updated"] == 2
        assert result["cancelled"] == 1
        assert task_13.status == TaskStatus.CANCELLED
        assert task_08.status == TaskStatus.PENDING
        assert task_18.status == TaskStatus.PENDING
        assert task_08.task_metadata["amount_g"] == 150.0
        assert task_18.task_metadata["amount_g"] == 150.0

    # ------------------------------------------------------------------
    # 5. Completed task protection — DONE task not in recalculate query
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_completed_tasks_filtered_by_query_on_plan_change(
        self, feeding_service, mock_db, sample_org
    ):
        """DONE tasks are filtered by WHERE status=PENDING; recalculate sees nothing."""
        plan, *_ = _make_plan(sample_org.id, amount_g=400, times=["08:00"])

        # DB returns empty — all tasks are DONE and filtered by the WHERE clause
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute = AsyncMock(return_value=mock_result)
        mock_db.flush = AsyncMock()

        result = await feeding_service.recalculate_future_tasks(plan, sample_org.id)

        assert result == {"updated": 0, "cancelled": 0}
        mock_db.flush.assert_not_called()

    # ------------------------------------------------------------------
    # 6. Pending task update — amount_g updated correctly
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_pending_task_amount_updated_after_plan_change(
        self, feeding_service, mock_db, sample_org
    ):
        """A single PENDING task has its amount_g updated to reflect new plan."""
        plan, plan_id, animal_id = _make_plan(
            sample_org.id, amount_g=400, times=["08:00"]
        )
        now = datetime(2026, 3, 5, 6, 0, 0, tzinfo=timezone.utc)
        task = _make_pending_task(sample_org.id, plan_id, animal_id, "08:00", now + timedelta(hours=2), 300.0)

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [task]
        mock_db.execute = AsyncMock(return_value=mock_result)
        mock_db.flush = AsyncMock()

        result = await feeding_service.recalculate_future_tasks(plan, sample_org.id)

        assert result == {"updated": 1, "cancelled": 0}
        assert task.task_metadata["amount_g"] == 400.0
        assert task.status == TaskStatus.PENDING

    # ------------------------------------------------------------------
    # 7. Manual modification protection — manually_modified task skipped
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_manually_modified_task_not_overwritten_by_recalculate(
        self, feeding_service, mock_db, sample_org
    ):
        """Task with manually_modified=True is skipped; amount stays unchanged."""
        plan, plan_id, animal_id = _make_plan(
            sample_org.id, amount_g=400, times=["08:00"]
        )
        now = datetime(2026, 3, 5, 6, 0, 0, tzinfo=timezone.utc)
        task = _make_pending_task(
            sample_org.id, plan_id, animal_id, "08:00",
            now + timedelta(hours=2), 999.0, manually_modified=True
        )

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [task]
        mock_db.execute = AsyncMock(return_value=mock_result)
        mock_db.flush = AsyncMock()

        result = await feeding_service.recalculate_future_tasks(plan, sample_org.id)

        # Skipped entirely — neither updated nor cancelled
        assert result == {"updated": 0, "cancelled": 0}
        assert task.task_metadata["amount_g"] == 999.0
        assert task.status == TaskStatus.PENDING

    # ------------------------------------------------------------------
    # 8. Animal leaves shelter — future tasks cancelled from departure time
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_animal_departure_cancels_all_future_tasks(
        self, feeding_service, mock_db, sample_org, sample_animal
    ):
        """cancel_future_tasks cancels all PENDING tasks after the departure time."""
        departure_time = datetime(2026, 3, 5, 14, 0, 0, tzinfo=timezone.utc)
        task_18 = Task(
            id=uuid4(), organization_id=sample_org.id,
            type=TaskType.FEEDING, status=TaskStatus.PENDING,
            title="Feed 18:00",
            due_at=datetime(2026, 3, 5, 18, 0, 0, tzinfo=timezone.utc),
            task_metadata={},
        )
        task_next = Task(
            id=uuid4(), organization_id=sample_org.id,
            type=TaskType.FEEDING, status=TaskStatus.PENDING,
            title="Feed next day",
            due_at=datetime(2026, 3, 6, 8, 0, 0, tzinfo=timezone.utc),
            task_metadata={},
        )

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [task_18, task_next]
        mock_db.execute = AsyncMock(return_value=mock_result)
        mock_db.flush = AsyncMock()

        cancelled = await feeding_service.cancel_future_tasks(
            animal_id=sample_animal.id,
            organization_id=sample_org.id,
            from_dt=departure_time,
        )

        assert cancelled == 2
        assert task_18.status == TaskStatus.CANCELLED
        assert task_next.status == TaskStatus.CANCELLED
        mock_db.flush.assert_called_once()

    # ------------------------------------------------------------------
    # 9. Double generation protection — idempotency
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_idempotent_generation_no_duplicate_tasks(
        self, feeding_service, mock_db, sample_org
    ):
        """When existing task is found during idempotency check, no new task is created."""
        plan, *_ = _make_plan(sample_org.id, amount_g=200, times=["08:00"])
        now = datetime(2026, 3, 5, 6, 0, 0, tzinfo=timezone.utc)
        to_dt = now + timedelta(hours=4)

        existing = Task(
            id=uuid4(), organization_id=sample_org.id,
            type=TaskType.FEEDING, status=TaskStatus.PENDING,
            due_at=datetime(2026, 3, 5, 8, 0, 0, tzinfo=timezone.utc),
            title="Feed",
        )

        mock_db.execute = AsyncMock(
            side_effect=_mock_execute_for_window(plan, existing_task=existing)
        )
        mock_db.flush = AsyncMock()

        created, fake_create = _patch_task_service()
        with patch("src.app.services.task_service.TaskService") as MockTS:
            MockTS.return_value.create_task = AsyncMock(side_effect=fake_create)
            await feeding_service.ensure_feeding_tasks_window(
                organization_id=sample_org.id, from_dt=now, to_dt=to_dt
            )

        # Existing task found → create_task never called
        assert len(created) == 0

    # ------------------------------------------------------------------
    # 10. Race condition — only PENDING tasks affected (WHERE clause protection)
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_race_condition_only_pending_tasks_in_recalculate_result(
        self, feeding_service, mock_db, sample_org
    ):
        """
        WHERE status=PENDING in the SQL query ensures COMPLETED tasks are never
        returned to recalculate_future_tasks, protecting against race conditions.
        """
        plan, plan_id, animal_id = _make_plan(
            sample_org.id, amount_g=400, times=["08:00", "18:00"]
        )
        now = datetime(2026, 3, 5, 10, 0, 0, tzinfo=timezone.utc)

        # DB returns only the PENDING task (COMPLETED task is filtered by WHERE clause)
        pending_task = _make_pending_task(
            sample_org.id, plan_id, animal_id, "18:00", now + timedelta(hours=8), 200.0
        )

        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [pending_task]
        mock_db.execute = AsyncMock(return_value=mock_result)
        mock_db.flush = AsyncMock()

        result = await feeding_service.recalculate_future_tasks(plan, sample_org.id)

        # Only the PENDING task is updated — COMPLETED task is not in result set
        assert result == {"updated": 1, "cancelled": 0}
        assert pending_task.task_metadata["amount_g"] == 200.0  # 400/2

    # ------------------------------------------------------------------
    # 11. Midnight boundary — 23:00 slot lands on correct date
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_midnight_boundary_late_slot_correct_date(
        self, feeding_service, mock_db, sample_org
    ):
        """Plan with 23:00 slot: task for today's 23:00 is in a 12h window from 12:00."""
        plan, *_ = _make_plan(
            sample_org.id, amount_g=200, times=["23:00"],
            start=date(2026, 3, 5)
        )

        # Window: 12:00 → 00:00 (exactly 12h)
        from_dt = datetime(2026, 3, 5, 12, 0, 0, tzinfo=timezone.utc)
        to_dt = from_dt + timedelta(hours=12)  # 2026-03-06 00:00

        mock_db.execute = AsyncMock(side_effect=_mock_execute_for_window(plan))
        mock_db.flush = AsyncMock()

        created, fake_create = _patch_task_service()
        with patch("src.app.services.task_service.TaskService") as MockTS:
            MockTS.return_value.create_task = AsyncMock(side_effect=fake_create)
            await feeding_service.ensure_feeding_tasks_window(
                organization_id=sample_org.id, from_dt=from_dt, to_dt=to_dt
            )

        # 2026-03-05 23:00 UTC is within [12:00, 00:00] → task created
        assert len(created) == 1
        assert created[0].due_at == datetime(2026, 3, 5, 23, 0, 0, tzinfo=timezone.utc)

    # ------------------------------------------------------------------
    # 12. Timezone safety — due_at is always UTC-aware
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_generated_tasks_are_timezone_aware_utc(
        self, feeding_service, mock_db, sample_org
    ):
        """Tasks created by ensure_feeding_tasks_window always have tz-aware due_at."""
        plan, *_ = _make_plan(
            sample_org.id, amount_g=200, times=["10:00"],
            start=date(2026, 3, 29)  # DST change day (Europe/Prague spring forward)
        )

        from_dt = datetime(2026, 3, 29, 0, 0, 0, tzinfo=timezone.utc)
        to_dt = from_dt + timedelta(hours=12)

        mock_db.execute = AsyncMock(side_effect=_mock_execute_for_window(plan))
        mock_db.flush = AsyncMock()

        created, fake_create = _patch_task_service()
        with patch("src.app.services.task_service.TaskService") as MockTS:
            MockTS.return_value.create_task = AsyncMock(side_effect=fake_create)
            await feeding_service.ensure_feeding_tasks_window(
                organization_id=sample_org.id, from_dt=from_dt, to_dt=to_dt
            )

        assert len(created) == 1
        due = created[0].due_at
        assert due.tzinfo is not None, "due_at must be timezone-aware"
        assert due == datetime(2026, 3, 29, 10, 0, 0, tzinfo=timezone.utc)

    # ------------------------------------------------------------------
    # 13. Explicit amounts in schedule_json — 167/167/166 distribution
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_explicit_amounts_in_schedule_json_used_directly(
        self, feeding_service, mock_db, sample_org
    ):
        """When schedule_json contains 'amounts', they are used per slot directly."""
        plan, *_ = _make_plan(
            sample_org.id, amount_g=500,
            times=["08:00", "13:00", "20:00"],
            amounts=[167, 167, 166],
        )

        from_dt = datetime(2026, 3, 5, 6, 0, 0, tzinfo=timezone.utc)
        to_dt = from_dt + timedelta(hours=16)  # covers 08:00, 13:00, 20:00

        mock_db.execute = AsyncMock(side_effect=_mock_execute_for_window(plan))
        mock_db.flush = AsyncMock()

        created, fake_create = _patch_task_service()
        with patch("src.app.services.task_service.TaskService") as MockTS:
            MockTS.return_value.create_task = AsyncMock(side_effect=fake_create)
            await feeding_service.ensure_feeding_tasks_window(
                organization_id=sample_org.id, from_dt=from_dt, to_dt=to_dt
            )

        assert len(created) == 3
        amounts = [t.task_metadata["amount_g"] for t in created]
        assert amounts == [167.0, 167.0, 166.0]
        assert sum(amounts) == 500.0

    # ------------------------------------------------------------------
    # 14. Plan overlap — creating new plan auto-closes the old one
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_plan_overlap_new_plan_auto_closes_existing(
        self, feeding_service, mock_db, mock_audit,
        sample_org, sample_animal, sample_user, sample_feeding_plan
    ):
        """Creating a new plan auto-closes any overlapping active plan."""
        existing = sample_feeding_plan
        existing.is_active = True
        existing.end_date = None

        call_count = 0

        async def mock_execute(stmt):
            nonlocal call_count
            call_count += 1
            result = MagicMock()
            if call_count == 1:
                result.scalars.return_value.all.return_value = [existing]
            else:
                # recalculate_future_tasks call → no pending tasks
                result.scalars.return_value.all.return_value = []
            return result

        mock_db.execute = AsyncMock(side_effect=mock_execute)
        mock_db.flush = AsyncMock()
        mock_db.add = MagicMock()

        new_start = date(2026, 3, 10)
        new_plan, n_closed = await feeding_service.create_feeding_plan(
            organization_id=sample_org.id,
            animal_id=sample_animal.id,
            start_date=new_start,
            created_by_id=sample_user.id,
            amount_g=400,
            times_per_day=2,
            schedule_json={"times": ["08:00", "18:00"]},
        )

        assert n_closed == 1
        assert existing.end_date == date(2026, 3, 9)  # auto_close_date = start - 1
        assert new_plan.is_active is True

    # ------------------------------------------------------------------
    # 15. Historical integrity — past tasks untouched by recalculate
    # ------------------------------------------------------------------

    @pytest.mark.asyncio
    async def test_historical_tasks_not_modified_after_plan_change(
        self, feeding_service, mock_db, sample_org
    ):
        """
        Past tasks have due_at < now and are filtered by WHERE due_at > now.
        recalculate_future_tasks returns 0/0 — historical data is never touched.
        """
        plan, *_ = _make_plan(
            sample_org.id, amount_g=400, times=["08:00"],
            start=date(2026, 3, 1)
        )

        # DB returns empty because all historical tasks are filtered out by WHERE due_at > now
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_db.execute = AsyncMock(return_value=mock_result)
        mock_db.flush = AsyncMock()

        result = await feeding_service.recalculate_future_tasks(plan, sample_org.id)

        assert result == {"updated": 0, "cancelled": 0}
        mock_db.flush.assert_not_called()
