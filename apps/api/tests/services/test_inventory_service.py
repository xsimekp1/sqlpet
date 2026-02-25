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
from src.app.models.inventory_transaction import (
    InventoryTransaction,
    TransactionType,
    TransactionReason,
)
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
def inventory_service(mock_db, mock_audit):
    """Create InventoryService instance with mocks"""
    service = InventoryService(mock_db)
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
def sample_item(sample_org):
    """Sample inventory item"""
    return InventoryItem(
        id=uuid4(),
        name="Dog Food - Premium Dry",
        category=InventoryCategory.FOOD,
        unit="kg",
        reorder_threshold=Decimal("10.00"),
        quantity_current=Decimal("50.00"),  # Initial stock
    )


@pytest.fixture
def sample_lot(sample_org, sample_item):
    """Sample inventory lot"""
    return InventoryLot(
        id=uuid4(),
        item_id=sample_item.id,
        lot_number="LOT-2024-001",
        quantity=Decimal("50.00"),
        expires_at=date.today() + timedelta(days=180),
    )


class TestInventoryService:
    """Test InventoryService methods"""

    @pytest.mark.asyncio
    async def test_create_item(
        self, inventory_service, mock_db, mock_audit, sample_org, sample_user
    ):
        """Test creating an inventory item"""
        # Act
        result = await inventory_service.create_item(
            organization_id=sample_org.id,
            name="Dog Food - Premium",
            category=InventoryCategory.FOOD,
            created_by_id=sample_user.id,
            unit="kg",
            reorder_threshold=10,
        )

        # Assert
        assert result.name == "Dog Food - Premium"
        assert result.category == InventoryCategory.FOOD
        assert result.unit == "kg"
        mock_db.add.assert_called_once()
        mock_db.flush.assert_called_once()
        mock_audit.log_action.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_lot(
        self,
        inventory_service,
        mock_db,
        mock_audit,
        sample_org,
        sample_user,
        sample_item,
    ):
        """Test creating an inventory lot"""
        # Mock record_transaction to avoid double db.add/flush counting
        inventory_service.record_transaction = AsyncMock(return_value=MagicMock())

        # Act
        result = await inventory_service.create_lot(
            organization_id=sample_org.id,
            item_id=sample_item.id,
            quantity=100,
            created_by_id=sample_user.id,
            lot_number="LOT-2024-002",
            expires_at=date.today() + timedelta(days=365),
        )

        # Assert
        assert result.item_id == sample_item.id
        assert result.lot_number == "LOT-2024-002"
        # Lot is initialised with quantity=0; record_transaction(IN, 100) sets the real value
        assert result.quantity == 0
        mock_db.add.assert_called_once()
        mock_db.flush.assert_called_once()
        inventory_service.record_transaction.assert_called_once()
        mock_audit.log_action.assert_called_once()

    @pytest.mark.asyncio
    async def test_record_transaction_in(
        self,
        inventory_service,
        mock_db,
        mock_audit,
        sample_org,
        sample_item,
        sample_lot,
        sample_user,
    ):
        """Test recording an IN transaction"""
        # Arrange
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_item
        mock_db.execute = AsyncMock(return_value=mock_result)

        # Act
        result = await inventory_service.record_transaction(
            organization_id=sample_org.id,
            item_id=sample_item.id,
            lot_id=sample_lot.id,
            reason=TransactionReason.PURCHASE,
            quantity=Decimal("25.00"),
            note="Received new shipment",
            user_id=sample_user.id,
        )

        # Assert
        assert result.direction == TransactionType.IN
        assert result.quantity == Decimal("25.00")
        mock_db.add.assert_called_once()
        mock_db.flush.assert_called_once()
        mock_audit.log_action.assert_called_once()

    @pytest.mark.asyncio
    async def test_record_transaction_out(
        self,
        inventory_service,
        mock_db,
        mock_audit,
        sample_org,
        sample_item,
        sample_lot,
        sample_user,
    ):
        """Test recording an OUT transaction"""
        # Arrange
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_item
        mock_db.execute = AsyncMock(return_value=mock_result)

        # Act
        result = await inventory_service.record_transaction(
            organization_id=sample_org.id,
            item_id=sample_item.id,
            lot_id=sample_lot.id,
            reason=TransactionReason.CONSUMPTION,
            quantity=Decimal("10.00"),
            note="Used for feeding",
            user_id=sample_user.id,
        )

        # Assert
        assert result.direction == TransactionType.OUT
        assert result.quantity == Decimal("10.00")
        mock_db.add.assert_called_once()
        mock_db.flush.assert_called_once()
        mock_audit.log_action.assert_called_once()

    @pytest.mark.asyncio
    async def test_record_transaction_negative_stock_prevention(
        self,
        inventory_service,
        mock_db,
        sample_org,
        sample_item,
        sample_user,
    ):
        """Test that negative stock is prevented"""
        # Arrange - item has only 10 units
        sample_item.quantity_current = Decimal("10.00")

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_item
        mock_db.execute = AsyncMock(return_value=mock_result)

        # Act & Assert - trying to deduct 20 should fail
        with pytest.raises(ValueError, match="stock would be negative"):
            await inventory_service.record_transaction(
                organization_id=sample_org.id,
                item_id=sample_item.id,
                reason=TransactionReason.CONSUMPTION,
                quantity=Decimal("20.00"),
                user_id=sample_user.id,
            )

    @pytest.mark.skip(reason="Mock not working correctly - needs refactoring")
    @pytest.mark.asyncio
    async def test_deduct_for_feeding_fifo_single_lot(
        self,
        inventory_service,
        mock_db,
        sample_org,
        sample_item,
        sample_lot,
        sample_user,
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
        mock_lot_result.scalars.return_value.all.return_value = [sample_lot]

        async def mock_execute(query):
            query_str = str(query)
            # Check for table names in the compiled query
            if hasattr(query, "selectee"):
                if query.selectee.name == "inventory_items":
                    return mock_item_result
                elif query.selectee.name == "inventory_lots":
                    return mock_lot_result
            return MagicMock()

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        # Mock record_transaction
        mock_transaction = MagicMock(
            id=uuid4(), type=TransactionType.OUT, quantity=Decimal("-0.20")
        )
        inventory_service.record_transaction = AsyncMock(return_value=mock_transaction)

        # Act
        result = await inventory_service.deduct_for_feeding(
            organization_id=sample_org.id,
            food_name="Dog Food - Premium Dry",
            amount_g=200,  # 200 grams
            feeding_log_id=feeding_log_id,
            user_id=sample_user.id,
        )

        # Assert - result is a list
        assert isinstance(result, list)
        assert len(result) == 1
        deduction = result[0]
        assert deduction["item"] == sample_item
        assert deduction["lot"] == sample_lot
        assert abs(deduction["quantity_deducted"] - 0.2) < 1e-9  # 200g = 0.2kg

        # Verify record_transaction was called correctly
        inventory_service.record_transaction.assert_called_once()
        call_args = inventory_service.record_transaction.call_args[1]
        assert call_args.get("reason") == TransactionReason.CONSUMPTION
        assert (
            abs(call_args["quantity"] - 0.2) < 1e-9
        )  # 200g = 0.2kg, passed as positive
        assert call_args["related_entity_type"] == "feeding_log"
        assert call_args["related_entity_id"] == feeding_log_id

    @pytest.mark.skip(reason="Mock not working correctly - needs refactoring")
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
            expires_at=date.today()
            + timedelta(days=30),  # Expires soon (should be used first)
        )

        lot_expires_later = InventoryLot(
            id=uuid4(),
            item_id=sample_item.id,
            lot_number="LOT-NEW",
            quantity=Decimal("50.00"),
            expires_at=date.today() + timedelta(days=365),  # Expires later
        )

        # Mock finding item
        mock_item_result = MagicMock()
        mock_item_result.scalar_one_or_none.return_value = sample_item

        # Mock finding lots - should return both, ordered by expiry (FIFO)
        mock_lot_result = MagicMock()
        mock_lot_result.scalars.return_value.all.return_value = [
            lot_expires_soon,
            lot_expires_later,
        ]

        async def mock_execute(query):
            if hasattr(query, "selectee"):
                if query.selectee.name == "inventory_items":
                    return mock_item_result
                elif query.selectee.name == "inventory_lots":
                    return mock_lot_result
            return MagicMock()

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        # Mock record_transaction
        inventory_service.record_transaction = AsyncMock(return_value=MagicMock())

        # Act
        result = await inventory_service.deduct_for_feeding(
            organization_id=sample_org.id,
            food_name="Dog Food - Premium Dry",
            amount_g=200,
            feeding_log_id=feeding_log_id,
            user_id=sample_user.id,
        )

        # Assert - result is a list
        assert isinstance(result, list)
        assert len(result) >= 1
        # First deduction should use the lot expiring sooner
        assert result[0]["lot"] == lot_expires_soon

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
                organization_id=sample_org.id,
                food_name="Non-existent Food",
                amount_g=200,
                feeding_log_id=uuid4(),
                user_id=sample_user.id,
            )

    @pytest.mark.skip(reason="Mock not working correctly - needs refactoring")
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
        mock_lot_result.scalars.return_value.all.return_value = []

        async def mock_execute(query):
            if hasattr(query, "selectee"):
                if query.selectee.name == "inventory_items":
                    return mock_item_result
                elif query.selectee.name == "inventory_lots":
                    return mock_lot_result
            return MagicMock()

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        # Act & Assert
        with pytest.raises(ValueError, match="No stock available"):
            await inventory_service.deduct_for_feeding(
                organization_id=sample_org.id,
                food_name="Dog Food - Premium Dry",
                amount_g=200,
                feeding_log_id=uuid4(),
                user_id=sample_user.id,
            )

    @pytest.mark.asyncio
    async def test_record_transaction_decimal_input_no_type_error(
        self,
        inventory_service,
        mock_db,
        mock_audit,
        sample_org,
        sample_item,
        sample_lot,
        sample_user,
    ):
        """Regression test: record_transaction must not raise TypeError when
        quantity is Decimal and lot.quantity is also Decimal (Decimal + float mix).
        Previously crashed with: unsupported operand type(s) for +: 'decimal.Decimal' + 'float'
        """
        # Arrange: item.quantity_current is Decimal (as returned by SQLAlchemy Numeric column)
        sample_item.quantity_current = Decimal("100.00")
        # lot.quantity is also Decimal
        sample_lot.quantity = Decimal("100.00")

        call_count = 0

        async def mock_execute(query):
            nonlocal call_count
            call_count += 1
            mock_result = MagicMock()
            if call_count == 1:
                mock_result.scalar_one_or_none.return_value = sample_item
            else:
                mock_result.scalar_one_or_none.return_value = sample_lot
            return mock_result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        # Act: pass Decimal quantity (as ReceivePurchaseOrderItem schema sends it)
        result = await inventory_service.record_transaction(
            organization_id=sample_org.id,
            item_id=sample_item.id,
            lot_id=sample_lot.id,
            reason=TransactionReason.PURCHASE,
            quantity=Decimal("25.50"),  # Decimal from Pydantic schema
            note="Received from PO-001",
            user_id=sample_user.id,
        )

        # Assert no crash and correct result
        assert result.direction == TransactionType.IN
        assert result.note == "Received from PO-001"
        # lot.quantity should have been updated: 100.00 + 25.50 = 125.50
        assert abs(float(sample_lot.quantity) - 125.50) < 0.001

    @pytest.mark.asyncio
    async def test_record_transaction_sets_note(
        self,
        inventory_service,
        mock_db,
        mock_audit,
        sample_org,
        sample_item,
        sample_user,
    ):
        """Test that the note field is persisted on the transaction record."""
        sample_item.quantity_current = Decimal("50.00")

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_item
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await inventory_service.record_transaction(
            organization_id=sample_org.id,
            item_id=sample_item.id,
            reason=TransactionReason.DONATION,
            quantity=5.0,
            note="Donated by local vet clinic",
            user_id=sample_user.id,
        )

        assert result.note == "Donated by local vet clinic"

    @pytest.mark.asyncio
    async def test_record_transaction_note_none_by_default(
        self,
        inventory_service,
        mock_db,
        mock_audit,
        sample_org,
        sample_item,
        sample_user,
    ):
        """Test that note defaults to None when not provided."""
        sample_item.quantity_current = Decimal("50.00")

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_item
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await inventory_service.record_transaction(
            organization_id=sample_org.id,
            item_id=sample_item.id,
            reason=TransactionReason.DONATION,
            quantity=3.0,
            user_id=sample_user.id,
        )

        assert result.note is None

    @pytest.mark.asyncio
    async def test_record_transaction_lot_quantity_updates_correctly_with_decimal(
        self,
        inventory_service,
        mock_db,
        mock_audit,
        sample_org,
        sample_item,
        sample_lot,
        sample_user,
    ):
        """Test lot quantity calculation is correct when lot.quantity is Decimal."""
        sample_item.quantity_current = Decimal("20.00")
        sample_lot.quantity = Decimal("20.00")

        call_count = 0

        async def mock_execute(query):
            nonlocal call_count
            call_count += 1
            mock_result = MagicMock()
            if call_count == 1:
                mock_result.scalar_one_or_none.return_value = sample_item
            else:
                mock_result.scalar_one_or_none.return_value = sample_lot
            return mock_result

        mock_db.execute = AsyncMock(side_effect=mock_execute)

        # Deduct 5 units (OUT/CONSUMPTION)
        await inventory_service.record_transaction(
            organization_id=sample_org.id,
            item_id=sample_item.id,
            lot_id=sample_lot.id,
            reason=TransactionReason.CONSUMPTION,
            quantity=5.0,
            user_id=sample_user.id,
        )

        # lot.quantity should be 20 - 5 = 15
        assert abs(float(sample_lot.quantity) - 15.0) < 0.001
        # item.quantity_current should be 20 - 5 = 15
        assert abs(float(sample_item.quantity_current) - 15.0) < 0.001
