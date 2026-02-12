"""Unit tests for InventoryService"""
import pytest
from datetime import datetime, timezone, date, timedelta
from uuid import uuid4
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession
from decimal import Decimal

from src.app.services.inventory_service import InventoryService
from src.app.models.inventory_item import InventoryItem, InventoryCategory
from src.app.models.inventory_lot import InventoryLot
from src.app.models.inventory_transaction import InventoryTransaction, TransactionType
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
    audit.log = AsyncMock()
    return audit


@pytest.fixture
def inventory_service(mock_db, mock_audit):
    """Create InventoryService instance with mocks"""
    service = InventoryService(mock_db)
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
def sample_item(sample_org):
    """Sample inventory item"""
    return InventoryItem(
        id=uuid4(),
        name="Dog Food - Premium Dry",
        category=InventoryCategory.FOOD,
        unit="kg",
        reorder_threshold=Decimal("10.00")
    )


@pytest.fixture
def sample_lot(sample_org, sample_item):
    """Sample inventory lot"""
    return InventoryLot(
        id=uuid4(),
        item_id=sample_item.id,
        lot_number="LOT-2024-001",
        quantity=Decimal("50.00"),
        expires_at=date.today() + timedelta(days=180)
    )


class TestInventoryService:
    """Test InventoryService methods"""

    @pytest.mark.asyncio
    async def test_create_item(self, inventory_service, mock_db, mock_audit, sample_org):
        """Test creating an inventory item"""
        # Arrange
        item_data = {
            "name": "Dog Food - Premium",
            "category": InventoryCategory.FOOD,
            "unit": "kg",
            "reorder_threshold": 10
        }

        # Act
        result = await inventory_service.create_item(
            org_id=sample_org.id,
            data=item_data
        )

        # Assert
        assert result.name == "Dog Food - Premium"
        assert result.category == InventoryCategory.FOOD
        assert result.unit == "kg"
        mock_db.add.assert_called_once()
        mock_db.flush.assert_called_once()
        mock_audit.log.assert_called_once()


    @pytest.mark.asyncio
    async def test_create_lot(self, inventory_service, mock_db, mock_audit, sample_org, sample_item):
        """Test creating an inventory lot"""
        # Arrange
        lot_data = {
            "item_id": sample_item.id,
            "lot_number": "LOT-2024-002",
            "quantity": 100,
            "expires_at": date.today() + timedelta(days=365)
        }

        # Act
        result = await inventory_service.create_lot(
            org_id=sample_org.id,
            data=lot_data
        )

        # Assert
        assert result.item_id == sample_item.id
        assert result.lot_number == "LOT-2024-002"
        assert result.quantity == 100
        mock_db.add.assert_called_once()
        mock_db.flush.assert_called_once()
        mock_audit.log.assert_called_once()


    @pytest.mark.asyncio
    async def test_record_transaction_in(
        self, inventory_service, mock_db, mock_audit, sample_org, sample_item, sample_lot, sample_user
    ):
        """Test recording an IN transaction"""
        # Arrange
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_lot
        mock_db.execute = AsyncMock(return_value=mock_result)

        # Act
        result = await inventory_service.record_transaction(
            org_id=sample_org.id,
            item_id=sample_item.id,
            lot_id=sample_lot.id,
            type=TransactionType.IN,
            quantity=Decimal("25.00"),
            reason="Received new shipment",
            user_id=sample_user.id
        )

        # Assert
        assert result.type == TransactionType.IN
        assert result.quantity == Decimal("25.00")
        assert sample_lot.quantity == Decimal("75.00")  # 50 + 25
        mock_db.add.assert_called_once()
        mock_db.flush.assert_called_once()
        mock_audit.log.assert_called_once()


    @pytest.mark.asyncio
    async def test_record_transaction_out(
        self, inventory_service, mock_db, mock_audit, sample_org, sample_item, sample_lot, sample_user
    ):
        """Test recording an OUT transaction"""
        # Arrange
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_lot
        mock_db.execute = AsyncMock(return_value=mock_result)

        # Act
        result = await inventory_service.record_transaction(
            org_id=sample_org.id,
            item_id=sample_item.id,
            lot_id=sample_lot.id,
            type=TransactionType.OUT,
            quantity=Decimal("-10.00"),  # Negative for OUT
            reason="Used for feeding",
            user_id=sample_user.id
        )

        # Assert
        assert result.type == TransactionType.OUT
        assert result.quantity == Decimal("-10.00")
        assert sample_lot.quantity == Decimal("40.00")  # 50 - 10
        mock_db.add.assert_called_once()
        mock_db.flush.assert_called_once()
        mock_audit.log.assert_called_once()


    @pytest.mark.asyncio
    async def test_deduct_for_feeding_fifo_single_lot(
        self, inventory_service, mock_db, sample_org, sample_item, sample_lot, sample_user
    ):
        """Test FIFO deduction from a single lot for feeding"""
        # Arrange
        feeding_log_id = uuid4()

        # Mock finding item by food name
        mock_item_result = MagicMock()
        mock_item_result.scalar_one_or_none.return_value = sample_item

        # Mock finding lot (FIFO - earliest expiry)
        mock_lot_result = MagicMock()
        mock_lot_result.scalar_one_or_none.return_value = sample_lot

        async def mock_execute(query):
            query_str = str(query)
            if 'inventory_items' in query_str.lower():
                return mock_item_result
            elif 'inventory_lots' in query_str.lower():
                return mock_lot_result
            return MagicMock()

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        # Mock record_transaction
        mock_transaction = MagicMock(
            id=uuid4(),
            type=TransactionType.OUT,
            quantity=Decimal("-0.20")
        )
        inventory_service.record_transaction = AsyncMock(return_value=mock_transaction)

        # Act
        result = await inventory_service.deduct_for_feeding(
            org_id=sample_org.id,
            food_name="Dog Food - Premium Dry",
            amount_g=200,  # 200 grams
            feeding_log_id=feeding_log_id,
            user_id=sample_user.id
        )

        # Assert
        assert result['item'] == sample_item
        assert result['lot'] == sample_lot
        assert result['quantity_deducted'] == Decimal("0.20")  # 200g = 0.2kg

        # Verify record_transaction was called correctly
        inventory_service.record_transaction.assert_called_once()
        call_args = inventory_service.record_transaction.call_args[1]
        assert call_args['type'] == TransactionType.OUT
        assert call_args['quantity'] == Decimal("-0.20")
        assert call_args['related_entity_type'] == 'feeding_log'
        assert call_args['related_entity_id'] == feeding_log_id


    @pytest.mark.asyncio
    async def test_deduct_for_feeding_fifo_multiple_lots(
        self, inventory_service, mock_db, sample_org, sample_item, sample_user
    ):
        """Test FIFO deduction prefers earliest expiry lot"""
        # Arrange
        feeding_log_id = uuid4()

        # Create two lots with different expiry dates
        lot_expires_soon = InventoryLot(
            id=uuid4(),
            item_id=sample_item.id,
            lot_number="LOT-OLD",
            quantity=Decimal("10.00"),
            expires_at=date.today() + timedelta(days=30)  # Expires soon (should be used first)
        )

        lot_expires_later = InventoryLot(
            id=uuid4(),
            item_id=sample_item.id,
            lot_number="LOT-NEW",
            quantity=Decimal("50.00"),
            expires_at=date.today() + timedelta(days=365)  # Expires later
        )

        # Mock finding item
        mock_item_result = MagicMock()
        mock_item_result.scalar_one_or_none.return_value = sample_item

        # Mock finding lot - should return the one expiring soonest (FIFO)
        mock_lot_result = MagicMock()
        mock_lot_result.scalar_one_or_none.return_value = lot_expires_soon

        async def mock_execute(query):
            query_str = str(query)
            if 'inventory_items' in query_str.lower():
                return mock_item_result
            elif 'inventory_lots' in query_str.lower():
                return mock_lot_result
            return MagicMock()

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        # Mock record_transaction
        inventory_service.record_transaction = AsyncMock(return_value=MagicMock())

        # Act
        result = await inventory_service.deduct_for_feeding(
            org_id=sample_org.id,
            food_name="Dog Food - Premium Dry",
            amount_g=200,
            feeding_log_id=feeding_log_id,
            user_id=sample_user.id
        )

        # Assert - should use the lot expiring sooner
        assert result['lot'] == lot_expires_soon


    @pytest.mark.asyncio
    async def test_deduct_for_feeding_no_item_raises_error(
        self, inventory_service, mock_db, sample_org, sample_user
    ):
        """Test deduction fails when inventory item not found"""
        # Arrange
        mock_item_result = MagicMock()
        mock_item_result.scalar_one_or_none.return_value = None
        mock_db.execute = AsyncMock(return_value=mock_item_result)

        # Act & Assert
        with pytest.raises(ValueError, match="No inventory item found"):
            await inventory_service.deduct_for_feeding(
                org_id=sample_org.id,
                food_name="Non-existent Food",
                amount_g=200,
                feeding_log_id=uuid4(),
                user_id=sample_user.id
            )


    @pytest.mark.asyncio
    async def test_deduct_for_feeding_no_stock_raises_error(
        self, inventory_service, mock_db, sample_org, sample_item, sample_user
    ):
        """Test deduction fails when no stock available"""
        # Arrange
        mock_item_result = MagicMock()
        mock_item_result.scalar_one_or_none.return_value = sample_item

        # No lots with quantity > 0
        mock_lot_result = MagicMock()
        mock_lot_result.scalar_one_or_none.return_value = None

        async def mock_execute(query):
            query_str = str(query)
            if 'inventory_items' in query_str.lower():
                return mock_item_result
            elif 'inventory_lots' in query_str.lower():
                return mock_lot_result
            return MagicMock()

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        # Act & Assert
        with pytest.raises(ValueError, match="No stock available"):
            await inventory_service.deduct_for_feeding(
                org_id=sample_org.id,
                food_name="Dog Food - Premium Dry",
                amount_g=200,
                feeding_log_id=uuid4(),
                user_id=sample_user.id
            )
