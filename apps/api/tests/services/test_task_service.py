"""Unit tests for TaskService"""
import pytest
from datetime import datetime, timezone
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.services.task_service import TaskService
from src.app.models.task import Task, TaskStatus, TaskType, TaskPriority
from src.app.models.user import User
from src.app.models.organization import Organization


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
def task_service(mock_db, mock_audit):
    """Create TaskService instance with mocks"""
    service = TaskService(mock_db)
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
def sample_task(sample_org, sample_user):
    """Sample task"""
    return Task(
        id=uuid4(),
        created_by_id=sample_user.id,
        title="Test Task",
        description="Test description",
        type=TaskType.GENERAL,
        status=TaskStatus.PENDING,
        priority=TaskPriority.MEDIUM,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )


class TestTaskService:
    """Test TaskService methods"""

    @pytest.mark.asyncio
    async def test_create_task(self, task_service, mock_db, mock_audit, sample_org, sample_user):
        """Test creating a new task"""
        # Arrange
        task_data = {
            "title": "New Task",
            "description": "Task description",
            "type": TaskType.FEEDING,
            "priority": TaskPriority.HIGH,
            "due_at": datetime.now(timezone.utc)
        }

        # Act
        result = await task_service.create_task(
            organization_id=sample_org.id,
            created_by_id=sample_user.id,
            title=task_data["title"],
            description=task_data["description"],
            task_type=task_data["type"],
            priority=task_data["priority"],
            due_at=task_data["due_at"],
        )

        # Assert
        assert result.title == "New Task"
        assert result.type == TaskType.FEEDING
        assert result.status == TaskStatus.PENDING
        mock_db.add.assert_called_once()
        mock_db.flush.assert_called_once()
        mock_audit.log_action.assert_called_once()


    @pytest.mark.asyncio
    async def test_complete_general_task(self, task_service, mock_db, mock_audit, sample_task, sample_user):
        """Test completing a general (non-feeding) task"""
        # Arrange
        sample_task.status = TaskStatus.PENDING
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_task
        mock_db.execute = AsyncMock(return_value=mock_result)

        # Act
        task, deductions = await task_service.complete_task(
            task_id=sample_task.id,
            organization_id=sample_task.organization_id,
            completed_by_id=sample_user.id,
        )

        # Assert
        assert task.status == TaskStatus.COMPLETED
        assert task.completed_at is not None
        assert deductions == []  # No inventory deductions for general task
        mock_db.flush.assert_called_once()
        mock_audit.log_action.assert_called_once()


    @pytest.mark.asyncio
    async def test_complete_feeding_task(
        self, task_service, mock_db, mock_audit, sample_task, sample_user
    ):
        """Test completing a feeding-type task marks it as completed"""
        # Arrange
        sample_task.type = TaskType.FEEDING
        sample_task.status = TaskStatus.PENDING

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_task
        mock_db.execute = AsyncMock(return_value=mock_result)

        # Act
        task, deductions = await task_service.complete_task(
            task_id=sample_task.id,
            organization_id=sample_task.organization_id,
            completed_by_id=sample_user.id,
        )

        # Assert
        assert task.status == TaskStatus.COMPLETED
        assert deductions == []  # No inventory item linked
        mock_db.flush.assert_called_once()
        mock_audit.log_action.assert_called_once()


    @pytest.mark.asyncio
    async def test_assign_task(self, task_service, mock_db, mock_audit, sample_task, sample_user):
        """Test assigning a task to a user"""
        # Arrange
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_task
        mock_db.execute = AsyncMock(return_value=mock_result)

        # Act
        result = await task_service.assign_task(
            task_id=sample_task.id,
            organization_id=sample_task.organization_id,
            assigned_to_id=sample_user.id,
            assigned_by_id=sample_user.id,
        )

        # Assert
        assert result.assigned_to_id == sample_user.id
        mock_db.flush.assert_called_once()
        mock_audit.log_action.assert_called_once()


    @pytest.mark.asyncio
    async def test_cancel_task(self, task_service, mock_db, mock_audit, sample_task, sample_user):
        """Test cancelling a task"""
        # Arrange
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_task
        mock_db.execute = AsyncMock(return_value=mock_result)

        # Act
        result = await task_service.cancel_task(
            task_id=sample_task.id,
            organization_id=sample_task.organization_id,
            cancelled_by_id=sample_user.id,
            reason="No longer needed"
        )

        # Assert
        assert result.status == TaskStatus.CANCELLED
        mock_db.flush.assert_called_once()
        mock_audit.log_action.assert_called_once()


    @pytest.mark.asyncio
    async def test_complete_already_completed_task_raises_error(
        self, task_service, mock_db, sample_task, sample_user
    ):
        """Test completing an already completed task raises error"""
        # Arrange
        sample_task.status = TaskStatus.COMPLETED
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_task
        mock_db.execute = AsyncMock(return_value=mock_result)

        # Act & Assert
        with pytest.raises(ValueError, match="is already completed"):
            await task_service.complete_task(
                task_id=sample_task.id,
                organization_id=sample_task.organization_id,
                completed_by_id=sample_user.id,
            )

    @pytest.mark.asyncio
    async def test_create_task_with_none_creator(
        self, task_service, mock_db, mock_audit, sample_org
    ):
        """
        Regression test: create_task must accept created_by_id=None.
        System-generated tasks (e.g. feeding tasks) have no user creator.
        Previously this caused a FK violation because organization_id was
        incorrectly passed as created_by_id to the users FK column.
        """
        result = await task_service.create_task(
            organization_id=sample_org.id,
            created_by_id=None,  # System-generated — no user
            title="Auto-generated feeding task",
            task_type=TaskType.FEEDING,
        )

        assert result.title == "Auto-generated feeding task"
        assert result.created_by_id is None
        assert result.type == TaskType.FEEDING
        assert result.status == TaskStatus.PENDING
        mock_db.add.assert_called_once()
        mock_db.flush.assert_called_once()

    @pytest.mark.asyncio
    async def test_complete_task_with_inventory_deduction(
        self, task_service, mock_db, mock_audit, sample_task, sample_user
    ):
        """Test completing a task with linked inventory item deducts from stock.

        When a task has linked_inventory_item_id and quantity_to_deduct_g in metadata,
        completing the task should automatically deduct from inventory.

        Example: Task to consume 200g from a 400g can (unit_weight_g=400):
        - 200g / 400g = 0.5 cans deducted from inventory
        """
        # Arrange
        inventory_item_id = uuid4()
        sample_task.linked_inventory_item_id = inventory_item_id
        sample_task.task_metadata = {"quantity_to_deduct_g": 200}
        sample_task.status = TaskStatus.PENDING

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_task
        mock_db.execute = AsyncMock(return_value=mock_result)

        # Mock the inventory service (patching where it's imported, not where it's defined)
        mock_deductions = [
            {
                "lot_id": uuid4(),
                "lot_number": "LOT001",
                "quantity_deducted": 0.5,  # 200g / 400g = 0.5 cans
                "lot_emptied": False,
                "transaction_id": uuid4(),
            }
        ]

        with patch(
            "src.app.services.inventory_service.InventoryService"
        ) as MockInventoryService:
            mock_inv_service = MagicMock()
            mock_inv_service.deduct_for_task = AsyncMock(return_value=mock_deductions)
            MockInventoryService.return_value = mock_inv_service

            # Act
            task, deductions = await task_service.complete_task(
                task_id=sample_task.id,
                organization_id=sample_task.organization_id,
                completed_by_id=sample_user.id,
            )

            # Assert
            assert task.status == TaskStatus.COMPLETED
            assert len(deductions) == 1
            assert deductions[0]["quantity_deducted"] == 0.5
            mock_inv_service.deduct_for_task.assert_called_once_with(
                organization_id=sample_task.organization_id,
                item_id=inventory_item_id,
                amount_g=200.0,
                task_id=sample_task.id,
                user_id=sample_user.id,
            )
