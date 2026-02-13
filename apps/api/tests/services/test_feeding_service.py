"""Unit tests for FeedingService"""
import uuid
import pytest
from datetime import datetime, timezone, date
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
    audit.log = AsyncMock()
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
    return Organization(
        id=uuid4(),
        name="Test Shelter",
        slug="test-shelter"
    )


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
        kcal_per_100g=380
    )


@pytest.fixture
def sample_animal(sample_org):
    """Sample animal"""
    return Animal(
        id=uuid4(),
        name="Max",
        public_code="A001",
        species="dog"
    )


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
        schedule_json=["08:00", "18:00"],
        start_date=date.today(),
        is_active=True
    )


class TestFeedingService:
    """Test FeedingService methods"""

    @pytest.mark.asyncio
    async def test_create_feeding_plan(
        self, feeding_service, mock_db, mock_audit, sample_org, sample_user, sample_animal, sample_food
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
        mock_audit.log.assert_called_once()


    @pytest.mark.asyncio
    async def test_log_feeding_without_inventory_deduction(
        self, feeding_service, mock_db, mock_audit, sample_org, sample_animal, sample_user
    ):
        """Test logging feeding without automatic inventory deduction"""
        # Act
        result = await feeding_service.log_feeding(
            organization_id=sample_org.id,
            animal_id=sample_animal.id,
            fed_by_user_id=sample_user.id,
            amount_text="1 cup",
            notes="Fed normally",
            auto_deduct_inventory=False
        )

        # Assert
        assert result.animal_id == sample_animal.id
        assert result.fed_by_user_id == sample_user.id
        assert result.amount_text == "1 cup"
        mock_db.add.assert_called_once()
        mock_db.flush.assert_called_once()
        mock_audit.log.assert_called_once()


    @pytest.mark.asyncio
    async def test_log_feeding_with_inventory_deduction(
        self, feeding_service, mock_db, mock_audit, sample_org, sample_animal,
        sample_user, sample_food, sample_feeding_plan
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
            if 'feeding_plans' in query_str.lower():
                return mock_plan_result
            elif 'foods' in query_str.lower():
                return mock_food_result
            return MagicMock()

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        # Mock InventoryService
        with patch('src.app.services.inventory_service.InventoryService') as MockInventoryService:
            mock_inv_service = AsyncMock()
            mock_inv_service.deduct_for_feeding = AsyncMock(return_value={
                "item": MagicMock(name=sample_food.name),
                "quantity_deducted": 0.2
            })
            MockInventoryService.return_value = mock_inv_service

            # Act
            result = await feeding_service.log_feeding(
                organization_id=sample_org.id,
                animal_id=sample_animal.id,
                fed_by_user_id=sample_user.id,
                amount_text="200g",
                auto_deduct_inventory=True
            )

            # Assert
            assert result.animal_id == sample_animal.id
            mock_inv_service.deduct_for_feeding.assert_called_once()
            call_args = mock_inv_service.deduct_for_feeding.call_args
            assert call_args[1]['food_name'] == sample_food.name
            assert call_args[1]['amount_g'] == 200


    @pytest.mark.asyncio
    async def test_deactivate_feeding_plan(
        self, feeding_service, mock_db, mock_audit, sample_org, sample_user, sample_feeding_plan
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
        mock_audit.log.assert_called_once()


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

        with patch.object(feeding_service, 'log_feeding') as mock_log_feeding:
            mock_log_feeding.return_value = mock_feeding_log

            with patch('src.app.services.task_service.TaskService') as MockTaskService:
                mock_task_svc = AsyncMock()
                mock_task_svc.complete_task = AsyncMock(return_value=mock_completed_task)
                MockTaskService.return_value = mock_task_svc

                result = await feeding_service.complete_feeding_task(
                    task_id=task_id,
                    organization_id=sample_org.id,
                    completed_by_user_id=sample_user.id,
                    notes="Task completed",
                )

        assert result["feeding_log"] == mock_feeding_log
        mock_log_feeding.assert_called_once()
        call_args = mock_log_feeding.call_args
        assert call_args[1]['animal_id'] == uuid.UUID(str(sample_animal.id))
        assert call_args[1]['auto_deduct_inventory'] is True
