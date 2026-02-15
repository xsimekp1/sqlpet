"""
Backend verification script for Task, Feeding, and Inventory systems.
Tests core functionality end-to-end.

Usage:
    python test_backend.py
"""

import asyncio
import sys
from datetime import date, datetime, timedelta
from sqlalchemy import select

# Add src to path
sys.path.insert(0, 'src')

from app.db.session import AsyncSessionLocal
from app.services.task_service import TaskService
from app.services.feeding_service import FeedingService
from app.services.inventory_service import InventoryService
from app.models.task import Task, TaskType, TaskStatus
from app.models.feeding_plan import FeedingPlan
from app.models.feeding_log import FeedingLog
from app.models.inventory_item import InventoryItem, InventoryCategory
from app.models.inventory_lot import InventoryLot
from app.models.inventory_transaction import InventoryTransaction, TransactionType
from app.models.food import Food, FoodType
from app.models.organization import Organization
from app.models.user import User
from app.models.animal import Animal, Species, Sex
import uuid


class BackendTester:
    def __init__(self):
        self.db = None
        self.test_org_id = None
        self.test_user_id = None
        self.test_animal_id = None
        self.results = []

    async def setup(self):
        """Setup test environment."""
        self.db = AsyncSessionLocal()

        # Get or create test organization
        result = await self.db.execute(
            select(Organization).where(Organization.name == "Test Org").limit(1)
        )
        test_org = result.scalar_one_or_none()

        if not test_org:
            print("❌ No test organization found. Please run seed_data.py first.")
            return False

        self.test_org_id = test_org.id

        # Get a test user
        result = await self.db.execute(
            select(User).where(User.organization_id == self.test_org_id).limit(1)
        )
        test_user = result.scalar_one_or_none()

        if not test_user:
            print("❌ No test user found.")
            return False

        self.test_user_id = test_user.id

        # Get or create test animal
        result = await self.db.execute(
            select(Animal).where(Animal.organization_id == self.test_org_id).limit(1)
        )
        test_animal = result.scalar_one_or_none()

        if not test_animal:
            print("⚠️  No test animal found, creating one...")
            test_animal = Animal(
                id=uuid.uuid4(),
                organization_id=self.test_org_id,
                name="Test Dog",
                species=Species.DOG,
                sex=Sex.MALE,
            )
            self.db.add(test_animal)
            await self.db.commit()

        self.test_animal_id = test_animal.id

        print(f"✓ Setup complete")
        print(f"  Org ID: {self.test_org_id}")
        print(f"  User ID: {self.test_user_id}")
        print(f"  Animal ID: {self.test_animal_id}")
        return True

    async def test_task_system(self):
        """Test 1: Task system CRUD operations."""
        print("\n🧪 Test 1: Task System")

        task_service = TaskService(self.db)

        # Create task
        task = await task_service.create_task(
            organization_id=self.test_org_id,
            created_by_id=self.test_user_id,
            title="Test Task",
            description="Testing task creation",
            task_type=TaskType.GENERAL,
            task_metadata={"test": True},
        )
        await self.db.commit()

        if task and task.id:
            print(f"  ✓ Created task: {task.id}")
            self.results.append(("Task Creation", True, None))
        else:
            print(f"  ❌ Failed to create task")
            self.results.append(("Task Creation", False, "No task returned"))
            return

        # Get tasks
        tasks, _total = await task_service.get_tasks_for_organization(self.test_org_id)
        if len(tasks) > 0:
            print(f"  ✓ Retrieved {len(tasks)} tasks")
            self.results.append(("Task Retrieval", True, None))
        else:
            print(f"  ❌ Failed to retrieve tasks")
            self.results.append(("Task Retrieval", False, "No tasks found"))

        # Complete task
        completed_task = await task_service.complete_task(
            task_id=task.id,
            organization_id=self.test_org_id,
            completed_by_id=self.test_user_id,
        )
        await self.db.commit()

        if completed_task.status == TaskStatus.COMPLETED:
            print(f"  ✓ Completed task successfully")
            self.results.append(("Task Completion", True, None))
        else:
            print(f"  ❌ Task completion failed")
            self.results.append(("Task Completion", False, f"Status: {completed_task.status}"))

    async def test_inventory_system(self):
        """Test 2: Inventory system with lots and transactions."""
        print("\n🧪 Test 2: Inventory System")

        inv_service = InventoryService(self.db)

        # Create inventory item
        item = await inv_service.create_item(
            organization_id=self.test_org_id,
            name="Test Dog Food",
            category=InventoryCategory.FOOD,
            created_by_id=self.test_user_id,
            unit="kg",
            reorder_threshold=10.0,
        )
        await self.db.commit()

        if item and item.id:
            print(f"  ✓ Created inventory item: {item.name}")
            self.results.append(("Inventory Item Creation", True, None))
        else:
            print(f"  ❌ Failed to create inventory item")
            self.results.append(("Inventory Item Creation", False, "No item returned"))
            return None

        # Create lot
        lot = await inv_service.create_lot(
            organization_id=self.test_org_id,
            item_id=item.id,
            quantity=50.0,
            created_by_id=self.test_user_id,
            lot_number="LOT001",
            expires_at=date.today() + timedelta(days=365),
        )
        await self.db.commit()

        if lot and lot.quantity == 50.0:
            print(f"  ✓ Created lot with 50.0 kg")
            self.results.append(("Lot Creation", True, None))
        else:
            print(f"  ❌ Failed to create lot")
            self.results.append(("Lot Creation", False, "Lot not created"))
            return None

        # Get items with stock
        items_with_stock = await inv_service.get_items_with_stock(self.test_org_id)
        if len(items_with_stock) > 0:
            stock_info = items_with_stock[0]
            print(f"  ✓ Retrieved stock: {stock_info['total_quantity']} {item.unit}")
            self.results.append(("Stock Retrieval", True, None))
        else:
            print(f"  ❌ Failed to retrieve stock")
            self.results.append(("Stock Retrieval", False, "No stock data"))

        return item

    async def test_feeding_system(self, food_item):
        """Test 3: Feeding system with plans and logs."""
        print("\n🧪 Test 3: Feeding System")

        feeding_service = FeedingService(self.db)

        # Create food
        food = Food(
            id=uuid.uuid4(),
            organization_id=self.test_org_id,
            name=food_item.name if food_item else "Test Dog Food",
            brand="Test Brand",
            type=FoodType.DRY,
            kcal_per_100g=350.0,
        )
        self.db.add(food)
        await self.db.commit()

        print(f"  ✓ Created food: {food.name}")

        # Create feeding plan
        plan = await feeding_service.create_feeding_plan(
            organization_id=self.test_org_id,
            animal_id=self.test_animal_id,
            start_date=date.today(),
            created_by_id=self.test_user_id,
            food_id=food.id,
            amount_g=200.0,
            times_per_day=2,
            schedule_json={"times": ["08:00", "18:00"]},
        )
        await self.db.commit()

        if plan and plan.id:
            print(f"  ✓ Created feeding plan: {plan.amount_g}g, {plan.times_per_day}x/day")
            self.results.append(("Feeding Plan Creation", True, None))
        else:
            print(f"  ❌ Failed to create feeding plan")
            self.results.append(("Feeding Plan Creation", False, "No plan returned"))
            return None

        # Get active plans
        active_plans = await feeding_service.get_active_plans_for_animal(
            self.test_animal_id, self.test_org_id
        )
        if len(active_plans) > 0:
            print(f"  ✓ Retrieved {len(active_plans)} active plan(s)")
            self.results.append(("Active Plans Retrieval", True, None))
        else:
            print(f"  ❌ Failed to retrieve active plans")
            self.results.append(("Active Plans Retrieval", False, "No plans found"))

        return plan

    async def test_feeding_with_inventory_deduction(self, food_item):
        """Test 4: Feeding log with automatic inventory deduction."""
        print("\n🧪 Test 4: Feeding + Inventory Integration")

        feeding_service = FeedingService(self.db)
        inv_service = InventoryService(self.db)

        # Get initial stock
        items = await inv_service.get_items_with_stock(self.test_org_id)
        initial_stock = None
        for item in items:
            if item['item'].name == food_item.name:
                initial_stock = float(item['total_quantity'])
                break

        if initial_stock is None:
            print(f"  ❌ Could not find initial stock")
            self.results.append(("Initial Stock Check", False, "Stock not found"))
            return

        print(f"  Initial stock: {initial_stock} kg")

        # Log feeding (should auto-deduct 0.2 kg = 200g)
        feeding_log = await feeding_service.log_feeding(
            organization_id=self.test_org_id,
            animal_id=self.test_animal_id,
            fed_by_user_id=self.test_user_id,
            amount_text="200g",
            auto_deduct_inventory=True,
        )
        await self.db.commit()

        if feeding_log and feeding_log.id:
            print(f"  ✓ Created feeding log")
            self.results.append(("Feeding Log Creation", True, None))
        else:
            print(f"  ❌ Failed to create feeding log")
            self.results.append(("Feeding Log Creation", False, "No log created"))
            return

        # Check stock after feeding
        items = await inv_service.get_items_with_stock(self.test_org_id)
        final_stock = None
        for item in items:
            if item['item'].name == food_item.name:
                final_stock = float(item['total_quantity'])
                break

        if final_stock is not None:
            deducted = initial_stock - final_stock
            print(f"  Final stock: {final_stock} kg")
            print(f"  Deducted: {deducted} kg")

            # Should have deducted 0.2 kg
            if abs(deducted - 0.2) < 0.01:
                print(f"  ✓ Inventory deduction correct (200g)")
                self.results.append(("Inventory Deduction", True, None))
            else:
                print(f"  ⚠️  Inventory deduction unexpected: {deducted} kg (expected 0.2 kg)")
                self.results.append(("Inventory Deduction", False, f"Expected 0.2 kg, got {deducted} kg"))
        else:
            print(f"  ❌ Could not verify stock deduction")
            self.results.append(("Inventory Deduction", False, "Final stock not found"))

    async def test_task_feeding_integration(self):
        """Test 5: Task-based feeding workflow."""
        print("\n🧪 Test 5: Task-Feeding Integration")

        feeding_service = FeedingService(self.db)

        # Generate feeding tasks
        tasks_created = await feeding_service.generate_feeding_tasks_for_schedule(
            organization_id=self.test_org_id,
            current_time=datetime.now(),
        )
        await self.db.commit()

        if len(tasks_created) > 0:
            print(f"  ✓ Generated {len(tasks_created)} feeding task(s)")
            self.results.append(("Task Generation", True, None))

            # Complete first feeding task
            task = tasks_created[0]
            try:
                result = await feeding_service.complete_feeding_task(
                    task_id=task.id,
                    organization_id=self.test_org_id,
                    completed_by_user_id=self.test_user_id,
                    notes="Test completion",
                )
                await self.db.commit()

                if result and result['task'].status == TaskStatus.COMPLETED:
                    print(f"  ✓ Completed feeding task successfully")
                    print(f"  ✓ Created feeding log: {result['feeding_log'].id}")
                    self.results.append(("Task-Feeding Completion", True, None))
                else:
                    print(f"  ❌ Task completion failed")
                    self.results.append(("Task-Feeding Completion", False, "Status not completed"))
            except Exception as e:
                print(f"  ❌ Task completion error: {e}")
                self.results.append(("Task-Feeding Completion", False, str(e)))
        else:
            print(f"  ⚠️  No feeding tasks generated (expected if no schedules match current time)")
            self.results.append(("Task Generation", True, "No tasks needed"))

    async def cleanup(self):
        """Cleanup test data."""
        if self.db:
            await self.db.close()

    def print_summary(self):
        """Print test results summary."""
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)

        passed = sum(1 for _, success, _ in self.results if success)
        total = len(self.results)

        for test_name, success, error in self.results:
            status = "✓ PASS" if success else "❌ FAIL"
            error_msg = f" ({error})" if error and not success else ""
            print(f"{status:8} {test_name}{error_msg}")

        print("="*60)
        print(f"Results: {passed}/{total} tests passed")

        if passed == total:
            print("🎉 All tests passed!")
            return 0
        else:
            print(f"⚠️  {total - passed} test(s) failed")
            return 1

    async def run_all_tests(self):
        """Run all backend tests."""
        print("="*60)
        print("BACKEND VERIFICATION SCRIPT")
        print("="*60)

        if not await self.setup():
            return 1

        try:
            await self.test_task_system()
            food_item = await self.test_inventory_system()

            if food_item:
                await self.test_feeding_system(food_item)
                await self.test_feeding_with_inventory_deduction(food_item)

            await self.test_task_feeding_integration()

        except Exception as e:
            print(f"\n❌ Test execution error: {e}")
            import traceback
            traceback.print_exc()
            self.results.append(("Test Execution", False, str(e)))

        finally:
            await self.cleanup()

        return self.print_summary()


async def main():
    tester = BackendTester()
    exit_code = await tester.run_all_tests()
    sys.exit(exit_code)


if __name__ == "__main__":
    asyncio.run(main())
