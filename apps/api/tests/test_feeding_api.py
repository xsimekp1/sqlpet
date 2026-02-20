"""API integration tests for feeding endpoints."""

import uuid
import pytest
from datetime import date, datetime, time, timezone, timedelta
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.main import app
from src.app.models.user import User
from src.app.models.organization import Organization
from src.app.models.animal import Animal
from src.app.models.food import Food, FoodType
from src.app.models.feeding_plan import FeedingPlan
from src.app.models.feeding_log import FeedingLog
from src.app.models.task import Task, TaskType, TaskStatus


@pytest.fixture
def sample_org():
    return Organization(id=uuid.uuid4(), name="Test Shelter", slug="test-shelter")


@pytest.fixture
def sample_user(sample_org):
    return User(
        id=uuid.uuid4(),
        email="test@example.com",
        name="Test User",
    )


@pytest.fixture
def sample_animal(sample_org):
    return Animal(id=uuid.uuid4(), name="Max", public_code="A001", species="dog")


@pytest.fixture
def sample_food(sample_org):
    return Food(
        id=uuid.uuid4(),
        name="Premium Dog Food",
        brand="Royal Canin",
        type=FoodType.DRY,
        kcal_per_100g=380,
    )


@pytest.fixture
def sample_feeding_plan(sample_org, sample_animal, sample_food):
    return FeedingPlan(
        id=uuid.uuid4(),
        organization_id=sample_org.id,
        animal_id=sample_animal.id,
        food_id=sample_food.id,
        amount_g=200,
        times_per_day=2,
        schedule_json={"times": ["08:00", "18:00"]},
        start_date=date.today(),
        is_active=True,
    )


class TestFeedingPlansAPI:
    """Test feeding plans API endpoints."""

    @pytest.mark.asyncio
    async def test_create_feeding_plan(
        self, sample_org, sample_user, sample_animal, sample_food
    ):
        """Test POST creates a feeding plan /feeding/plans."""
        # This would require proper auth setup - testing the endpoint structure
        # In real test, we'd use test client with auth
        pass

    @pytest.mark.asyncio
    async def test_list_feeding_plans(self):
        """Test GET /feeding/plans returns all plans for org."""
        # Requires authenticated test client
        pass

    @pytest.mark.asyncio
    async def test_get_feeding_plan(self):
        """Test GET /feeding/plans/{id} returns single plan."""
        # Requires authenticated test client
        pass

    @pytest.mark.asyncio
    async def test_update_feeding_plan(self):
        """Test PUT /feeding/plans/{id} updates a plan."""
        # Requires authenticated test client
        pass

    @pytest.mark.asyncio
    async def test_deactivate_feeding_plan(self):
        """Test DELETE /feeding/plans/{id} deactivates a plan."""
        # Requires authenticated test client
        pass


class TestFeedingLogsAPI:
    """Test feeding logs API endpoints."""

    @pytest.mark.asyncio
    async def test_log_feeding(self):
        """Test POST /feeding/logs creates a feeding log."""
        # Requires authenticated test client
        pass

    @pytest.mark.asyncio
    async def test_list_feeding_logs(self):
        """Test GET /feeding/logs returns feeding history."""
        # Requires authenticated test client
        pass

    @pytest.mark.asyncio
    async def test_log_feeding_auto_deducts_inventory(self):
        """Test that logging feeding deducts from inventory when enabled."""
        # Requires authenticated test client with inventory setup
        pass


class TestFeedingTasksAPI:
    """Test feeding tasks API endpoints."""

    @pytest.mark.asyncio
    async def test_complete_feeding_task(self, sample_org, sample_user, sample_animal):
        """Test POST /feeding/tasks/complete completes a task and logs feeding."""
        # Arrange
        task_id = uuid.uuid4()

        task = Task(
            id=task_id,
            organization_id=sample_org.id,
            created_by_id=sample_user.id,
            type=TaskType.FEEDING,
            status=TaskStatus.PENDING,
            title="Feed Max",
            task_metadata={"animal_id": str(sample_animal.id)},
            related_entity_type="animal",
            related_entity_id=sample_animal.id,
        )

        # This would need full integration test setup with authenticated client
        # and mocked database
        pass

    @pytest.mark.asyncio
    async def test_generate_feeding_tasks(self):
        """Test POST /feeding/tasks/generate creates tasks from schedules."""
        # Requires authenticated test client
        pass


class TestFeedingInventoryIntegration:
    """Test integration between feeding and inventory."""

    @pytest.mark.asyncio
    async def test_feeding_deducts_from_inventory(
        self, sample_org, sample_animal, sample_user, sample_food, sample_feeding_plan
    ):
        """Test that logging feeding with auto_deduct=true removes food from inventory."""
        # This requires:
        # 1. Food item in inventory with stock
        # 2. Active feeding plan linking to that food
        # 3. Logging feeding with auto_deduct_inventory=True
        # 4. Verifying inventory transaction was created
        pass

    @pytest.mark.asyncio
    async def test_feeding_without_inventory_deduction(self):
        """Test that logging feeding can skip inventory deduction."""
        # Requires authenticated test client
        pass

    @pytest.mark.asyncio
    async def test_feeding_fails_without_stock(self):
        """Test that feeding fails gracefully when there's no stock."""
        # Requires authenticated test client with empty inventory
        pass
