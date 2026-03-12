"""
Seed feeding data for testing/screenshots.

Creates:
- Food inventory items (Royal Canin, Hills, Brit, etc.)
- Feeding plans for animals
- Completed feeding tasks (historical data for reports)

Usage:
  cd apps/api
  python scripts/seed_feeding_data.py

For Railway:
  railway run python scripts/seed_feeding_data.py
"""

import asyncio
import uuid
import random
from datetime import datetime, date, timedelta, timezone

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.db.session import AsyncSessionLocal
from src.app.models.organization import Organization
from src.app.models.user import User
from src.app.models.animal import Animal
from src.app.models.inventory_item import InventoryItem, ItemCategory
from src.app.models.feeding_plan import FeedingPlan
from src.app.models.task import Task, TaskType, TaskStatus, TaskPriority


# Food items to create
FOOD_ITEMS = [
    {"name": "Royal Canin Medium Adult", "brand": "Royal Canin", "species": "dog", "kcal": 364},
    {"name": "Royal Canin Maxi Adult", "brand": "Royal Canin", "species": "dog", "kcal": 349},
    {"name": "Royal Canin Mini Adult", "brand": "Royal Canin", "species": "dog", "kcal": 402},
    {"name": "Hills Science Diet Adult", "brand": "Hills", "species": "dog", "kcal": 363},
    {"name": "Hills Prescription Diet", "brand": "Hills", "species": "dog", "kcal": 295},
    {"name": "Brit Premium Adult L", "brand": "Brit", "species": "dog", "kcal": 378},
    {"name": "Brit Care Adult M", "brand": "Brit", "species": "dog", "kcal": 365},
    {"name": "Royal Canin Indoor Cat", "brand": "Royal Canin", "species": "cat", "kcal": 375},
    {"name": "Royal Canin Sterilised", "brand": "Royal Canin", "species": "cat", "kcal": 340},
    {"name": "Hills Science Cat Adult", "brand": "Hills", "species": "cat", "kcal": 382},
    {"name": "Brit Premium Cat Adult", "brand": "Brit", "species": "cat", "kcal": 365},
]


async def get_superadmin_org(db: AsyncSession) -> tuple[Organization, User]:
    """Get the superadmin user and their first organization."""
    # Find superadmin
    result = await db.execute(
        select(User).where(User.is_superadmin == True)
    )
    superadmin = result.scalar_one_or_none()

    if not superadmin:
        raise Exception("No superadmin found. Create one first.")

    print(f"Found superadmin: {superadmin.email}")

    # Get their first membership's organization
    from src.app.models.membership import Membership
    result = await db.execute(
        select(Membership).where(Membership.user_id == superadmin.id)
    )
    membership = result.scalars().first()

    if not membership:
        raise Exception("Superadmin has no organization membership.")

    result = await db.execute(
        select(Organization).where(Organization.id == membership.organization_id)
    )
    org = result.scalar_one()

    print(f"Using organization: {org.name} ({org.id})")

    return org, superadmin


async def create_food_items(db: AsyncSession, org_id: uuid.UUID) -> dict[str, InventoryItem]:
    """Create food inventory items if they don't exist."""
    foods = {}

    for food_data in FOOD_ITEMS:
        result = await db.execute(
            select(InventoryItem).where(
                and_(
                    InventoryItem.organization_id == org_id,
                    InventoryItem.name == food_data["name"],
                )
            )
        )
        item = result.scalar_one_or_none()

        if item:
            print(f"  Food exists: {food_data['name']}")
        else:
            item = InventoryItem(
                id=uuid.uuid4(),
                organization_id=org_id,
                name=food_data["name"],
                brand=food_data["brand"],
                category=ItemCategory.FOOD,
                unit="g",
                kcal_per_100g=food_data["kcal"],
                allowed_species=[food_data["species"]],
                is_active=True,
            )
            db.add(item)
            print(f"  Created food: {food_data['name']}")

        foods[food_data["name"]] = item

    await db.flush()
    return foods


async def create_feeding_plans_and_tasks(
    db: AsyncSession,
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    foods: dict[str, InventoryItem],
) -> None:
    """Create feeding plans and historical completed tasks for animals."""

    # Get all active animals in the shelter
    result = await db.execute(
        select(Animal).where(
            and_(
                Animal.organization_id == org_id,
                Animal.deleted_at.is_(None),
                Animal.current_intake_date.isnot(None),  # Currently in shelter
            )
        )
    )
    animals = result.scalars().all()

    if not animals:
        print("No animals found in shelter. Skipping feeding data.")
        return

    print(f"Found {len(animals)} animals in shelter")

    # Separate by species
    dogs = [a for a in animals if str(a.species) == 'dog' or (hasattr(a.species, 'value') and a.species.value == 'dog')]
    cats = [a for a in animals if str(a.species) == 'cat' or (hasattr(a.species, 'value') and a.species.value == 'cat')]

    print(f"  Dogs: {len(dogs)}, Cats: {len(cats)}")

    # Food lists by species
    dog_foods = [f for name, f in foods.items() if "Cat" not in name and "cat" not in name.lower()]
    cat_foods = [f for name, f in foods.items() if "Cat" in name or "cat" in name.lower()]

    today = date.today()
    now = datetime.now(timezone.utc)

    for animal in animals:
        species = str(animal.species) if not hasattr(animal.species, 'value') else animal.species.value
        is_dog = species == 'dog'
        available_foods = dog_foods if is_dog else cat_foods

        if not available_foods:
            print(f"  No food available for {animal.name} ({species})")
            continue

        # Pick a random food
        food = random.choice(available_foods)

        # Determine daily amount based on weight or estimate
        weight = animal.weight_current_kg or animal.weight_estimated_kg or (15 if is_dog else 4)
        daily_amount = int(weight * (25 if is_dog else 40))  # rough estimate

        # Create feeding plan (or skip if exists)
        result = await db.execute(
            select(FeedingPlan).where(
                and_(
                    FeedingPlan.animal_id == animal.id,
                    FeedingPlan.organization_id == org_id,
                    FeedingPlan.is_active == True,
                )
            )
        )
        existing_plan = result.scalar_one_or_none()

        if existing_plan:
            print(f"  Plan exists for {animal.name}")
            plan = existing_plan
        else:
            # Random frequency: 1, 2, or 3 times per day
            times_per_day = random.choice([1, 2, 2, 2, 3])  # 2x most common
            schedule_times = {
                1: ["07:00"],
                2: ["07:00", "18:00"],
                3: ["07:00", "12:00", "18:00"],
            }[times_per_day]

            per_meal = daily_amount // times_per_day
            amounts = [per_meal] * (times_per_day - 1) + [daily_amount - per_meal * (times_per_day - 1)]

            plan = FeedingPlan(
                id=uuid.uuid4(),
                organization_id=org_id,
                animal_id=animal.id,
                inventory_item_id=food.id,
                amount_g=daily_amount,
                schedule_json={"times": schedule_times, "amounts": amounts},
                start_date=today - timedelta(days=30),
                is_active=True,
            )
            db.add(plan)
            print(f"  Created plan for {animal.name}: {daily_amount}g/day, {times_per_day}x ({food.name})")

        # Create completed feeding tasks for the last 30 days
        schedule = plan.schedule_json or {"times": ["07:00", "18:00"], "amounts": [daily_amount // 2, daily_amount // 2]}
        times = schedule.get("times", ["07:00", "18:00"])
        amounts = schedule.get("amounts", [daily_amount // len(times)] * len(times))

        # Check how many tasks already exist
        result = await db.execute(
            select(Task).where(
                and_(
                    Task.organization_id == org_id,
                    Task.type == TaskType.FEEDING,
                    Task.related_entity_id == animal.id,
                )
            )
        )
        existing_tasks = result.scalars().all()

        if len(existing_tasks) > 10:
            print(f"    {len(existing_tasks)} tasks already exist for {animal.name}, skipping")
            continue

        # Generate tasks for past 30 days
        tasks_created = 0
        for days_ago in range(30, 0, -1):
            task_date = today - timedelta(days=days_ago)

            for idx, scheduled_time in enumerate(times):
                try:
                    time_obj = datetime.strptime(scheduled_time, "%H:%M").time()
                except ValueError:
                    continue

                due_at = datetime.combine(task_date, time_obj, tzinfo=timezone.utc)
                completed_at = due_at + timedelta(minutes=random.randint(0, 30))

                # Skip some randomly (10% miss rate)
                if random.random() < 0.1:
                    status = TaskStatus.CANCELLED
                else:
                    status = TaskStatus.COMPLETED

                amount_g = amounts[idx] if idx < len(amounts) else daily_amount // len(times)
                # Add some variation (±10%)
                amount_g = int(amount_g * random.uniform(0.9, 1.1))

                task = Task(
                    id=uuid.uuid4(),
                    organization_id=org_id,
                    created_by_id=user_id,
                    title=f"Krmení {animal.name}",
                    description=f"Krmení v {scheduled_time}. Množství: {amount_g}g",
                    type=TaskType.FEEDING,
                    priority=TaskPriority.MEDIUM,
                    status=status,
                    due_at=due_at,
                    completed_at=completed_at if status == TaskStatus.COMPLETED else None,
                    completed_by_id=user_id if status == TaskStatus.COMPLETED else None,
                    task_metadata={
                        "feeding_plan_id": str(plan.id),
                        "animal_id": str(animal.id),
                        "scheduled_time": scheduled_time,
                        "amount_g": amount_g,
                        "inventory_item_id": str(food.id),
                    },
                    related_entity_type="animal",
                    related_entity_id=animal.id,
                )
                db.add(task)
                tasks_created += 1

        print(f"    Created {tasks_created} feeding tasks for {animal.name}")

    await db.flush()


async def main():
    print("=" * 60)
    print("SEEDING FEEDING DATA")
    print("=" * 60)

    async with AsyncSessionLocal() as db:
        # Get superadmin and their org
        org, superadmin = await get_superadmin_org(db)

        print("\n1. Creating food inventory items...")
        foods = await create_food_items(db, org.id)

        print("\n2. Creating feeding plans and tasks...")
        await create_feeding_plans_and_tasks(db, org.id, superadmin.id, foods)

        await db.commit()

        print("\n" + "=" * 60)
        print("DONE!")
        print("=" * 60)
        print(f"Organization: {org.name}")
        print(f"Foods created: {len(FOOD_ITEMS)}")
        print("\nNow you can check:")
        print("- /dashboard/reports → Spotřeba krmiva")
        print("- /dashboard/feeding/plans → Krmné plány")
        print("- /dashboard/animals/[id] → Feeding tab → Historie spotřeby")


if __name__ == "__main__":
    asyncio.run(main())
