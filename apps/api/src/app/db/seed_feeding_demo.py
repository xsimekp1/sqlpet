"""Seed feeding demo data on startup (idempotent - only creates if minimal data exists)."""

import uuid
import random
from datetime import datetime, date, timedelta, timezone

from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.app.models.organization import Organization
from src.app.models.animal import Animal
from src.app.models.inventory_item import InventoryItem, ItemCategory
from src.app.models.feeding_plan import FeedingPlan
from src.app.models.task import Task, TaskType, TaskStatus, TaskPriority


# Food items to create
FOOD_ITEMS = [
    {"name": "Royal Canin Medium Adult", "brand": "Royal Canin", "species": "dog", "kcal": 364},
    {"name": "Royal Canin Maxi Adult", "brand": "Royal Canin", "species": "dog", "kcal": 349},
    {"name": "Hills Science Diet Adult", "brand": "Hills", "species": "dog", "kcal": 363},
    {"name": "Brit Premium Adult L", "brand": "Brit", "species": "dog", "kcal": 378},
    {"name": "Royal Canin Indoor Cat", "brand": "Royal Canin", "species": "cat", "kcal": 375},
    {"name": "Royal Canin Sterilised", "brand": "Royal Canin", "species": "cat", "kcal": 340},
    {"name": "Hills Science Cat Adult", "brand": "Hills", "species": "cat", "kcal": 382},
]


async def seed_feeding_demo_data(db: AsyncSession) -> dict:
    """
    Seed feeding demo data for screenshots/testing.
    Only creates data if there are few feeding tasks (<50).
    Returns dict with counts of created items.
    """
    result = {"foods": 0, "plans": 0, "tasks": 0, "skipped": False}

    # Get all organizations
    orgs_result = await db.execute(select(Organization))
    organizations = orgs_result.scalars().all()

    if not organizations:
        return result

    for org in organizations:
        # Check if org already has enough feeding data
        task_count_result = await db.execute(
            select(func.count(Task.id)).where(
                and_(
                    Task.organization_id == org.id,
                    Task.type == TaskType.FEEDING,
                )
            )
        )
        existing_tasks = task_count_result.scalar_one()

        if existing_tasks >= 50:
            result["skipped"] = True
            continue

        # Create food items
        foods = {}
        for food_data in FOOD_ITEMS:
            existing = await db.execute(
                select(InventoryItem).where(
                    and_(
                        InventoryItem.organization_id == org.id,
                        InventoryItem.name == food_data["name"],
                    )
                )
            )
            item = existing.scalar_one_or_none()

            if not item:
                item = InventoryItem(
                    id=uuid.uuid4(),
                    organization_id=org.id,
                    name=food_data["name"],
                    brand=food_data["brand"],
                    category=ItemCategory.FOOD,
                    unit="g",
                    kcal_per_100g=food_data["kcal"],
                    allowed_species=[food_data["species"]],
                    is_active=True,
                )
                db.add(item)
                result["foods"] += 1

            foods[food_data["species"]] = foods.get(food_data["species"], [])
            foods[food_data["species"]].append(item)

        await db.flush()

        # Get animals in shelter
        animals_result = await db.execute(
            select(Animal).where(
                and_(
                    Animal.organization_id == org.id,
                    Animal.deleted_at.is_(None),
                    Animal.current_intake_date.isnot(None),
                )
            )
        )
        animals = animals_result.scalars().all()

        if not animals:
            continue

        today = date.today()

        for animal in animals[:10]:  # Limit to 10 animals
            species = str(animal.species) if not hasattr(animal.species, 'value') else animal.species.value
            is_dog = species == 'dog'
            available_foods = foods.get('dog' if is_dog else 'cat', [])

            if not available_foods:
                continue

            food = random.choice(available_foods)
            weight = animal.weight_current_kg or animal.weight_estimated_kg or (15 if is_dog else 4)
            daily_amount = int(float(weight) * (25 if is_dog else 40))

            # Check for existing plan
            existing_plan = await db.execute(
                select(FeedingPlan).where(
                    and_(
                        FeedingPlan.animal_id == animal.id,
                        FeedingPlan.organization_id == org.id,
                        FeedingPlan.is_active == True,
                    )
                )
            )
            plan = existing_plan.scalar_one_or_none()

            if not plan:
                times_per_day = random.choice([1, 2, 2, 2, 3])
                schedule_times = {
                    1: ["07:00"],
                    2: ["07:00", "18:00"],
                    3: ["07:00", "12:00", "18:00"],
                }[times_per_day]

                per_meal = daily_amount // times_per_day
                amounts = [per_meal] * (times_per_day - 1) + [daily_amount - per_meal * (times_per_day - 1)]

                plan = FeedingPlan(
                    id=uuid.uuid4(),
                    organization_id=org.id,
                    animal_id=animal.id,
                    inventory_item_id=food.id,
                    amount_g=daily_amount,
                    schedule_json={"times": schedule_times, "amounts": amounts},
                    start_date=today - timedelta(days=30),
                    is_active=True,
                )
                db.add(plan)
                result["plans"] += 1

            # Create completed feeding tasks for past 14 days
            schedule = plan.schedule_json or {"times": ["07:00", "18:00"], "amounts": [daily_amount // 2, daily_amount // 2]}
            times = schedule.get("times", ["07:00", "18:00"])
            amounts = schedule.get("amounts", [daily_amount // len(times)] * len(times))

            # Get user for created_by (use first superadmin or any user)
            from src.app.models.user import User
            from src.app.models.membership import Membership

            user_result = await db.execute(
                select(User).where(User.is_superadmin == True).limit(1)
            )
            user = user_result.scalar_one_or_none()

            if not user:
                membership_result = await db.execute(
                    select(Membership).where(Membership.organization_id == org.id).limit(1)
                )
                membership = membership_result.scalar_one_or_none()
                if membership:
                    user_result = await db.execute(
                        select(User).where(User.id == membership.user_id)
                    )
                    user = user_result.scalar_one_or_none()

            if not user:
                continue

            for days_ago in range(14, 0, -1):
                task_date = today - timedelta(days=days_ago)

                for idx, scheduled_time in enumerate(times):
                    try:
                        time_obj = datetime.strptime(scheduled_time, "%H:%M").time()
                    except ValueError:
                        continue

                    due_at = datetime.combine(task_date, time_obj, tzinfo=timezone.utc)
                    completed_at = due_at + timedelta(minutes=random.randint(0, 30))

                    # 90% completion rate
                    status = TaskStatus.COMPLETED if random.random() < 0.9 else TaskStatus.CANCELLED
                    amount_g = amounts[idx] if idx < len(amounts) else daily_amount // len(times)
                    amount_g = int(amount_g * random.uniform(0.9, 1.1))

                    task = Task(
                        id=uuid.uuid4(),
                        organization_id=org.id,
                        created_by_id=user.id,
                        title=f"Krmení {animal.name}",
                        description=f"Krmení v {scheduled_time}. Množství: {amount_g}g",
                        type=TaskType.FEEDING,
                        priority=TaskPriority.MEDIUM,
                        status=status,
                        due_at=due_at,
                        completed_at=completed_at if status == TaskStatus.COMPLETED else None,
                        completed_by_id=user.id if status == TaskStatus.COMPLETED else None,
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
                    result["tasks"] += 1

        await db.flush()

    return result
