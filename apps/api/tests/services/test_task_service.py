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
        result = await task_service.complete_task(
            task_id=sample_task.id,
            organization_id=sample_task.organization_id,
            completed_by_id=sample_user.id,
        )

        # Assert
        assert result.status == TaskStatus.COMPLETED
        assert result.completed_at is not None
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
        result = await task_service.complete_task(
            task_id=sample_task.id,
            organization_id=sample_task.organization_id,
            completed_by_id=sample_user.id,
        )

        # Assert
        assert result.status == TaskStatus.COMPLETED
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
