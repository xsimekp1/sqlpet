# Backend Testing Guide

## Quick Start - Test the Complete Backend

### 1. Run Database Migrations

```bash
cd apps/api
alembic upgrade head
```

This will run both migrations:
- `004_add_tasks_table` - Creates tasks table with feeding integration fields
- `005_add_inventory_feeding` - Creates 6 tables (foods, feeding_plans, feeding_logs, inventory_items, inventory_lots, inventory_transactions)

### 2. Seed Permissions (if not done already)

```bash
cd apps/api
python -m src.app.db.seed_data
```

This creates permissions for:
- `tasks.read`, `tasks.write`
- `feeding.read`, `feeding.write`
- `inventory.read`, `inventory.write`

### 3. Run Automated Backend Tests

```bash
cd apps/api
python test_backend.py
```

This will test:
- ✅ Task CRUD operations (create, list, complete)
- ✅ Inventory system (items, lots, stock tracking)
- ✅ Feeding system (plans, logs, schedules)
- ✅ **Inventory deduction** when feeding logged (automatic)
- ✅ **Task-feeding integration** (complete task → create log → deduct inventory)

Expected output:
```
============================================================
BACKEND VERIFICATION SCRIPT
============================================================
✓ Setup complete
  Org ID: [uuid]
  User ID: [uuid]
  Animal ID: [uuid]

🧪 Test 1: Task System
  ✓ Created task: [uuid]
  ✓ Retrieved 1 tasks
  ✓ Completed task successfully

🧪 Test 2: Inventory System
  ✓ Created inventory item: Test Dog Food
  ✓ Created lot with 50.0 kg
  ✓ Retrieved stock: 50.0 kg

🧪 Test 3: Feeding System
  ✓ Created food: Test Dog Food
  ✓ Created feeding plan: 200.0g, 2x/day
  ✓ Retrieved 1 active plan(s)

🧪 Test 4: Feeding + Inventory Integration
  Initial stock: 50.0 kg
  ✓ Created feeding log
  Final stock: 49.8 kg
  Deducted: 0.2 kg
  ✓ Inventory deduction correct (200g)

🧪 Test 5: Task-Feeding Integration
  ✓ Generated 2 feeding task(s)
  ✓ Completed feeding task successfully
  ✓ Created feeding log: [uuid]

============================================================
TEST SUMMARY
============================================================
✓ PASS   Task Creation
✓ PASS   Task Retrieval
✓ PASS   Task Completion
✓ PASS   Inventory Item Creation
✓ PASS   Lot Creation
✓ PASS   Stock Retrieval
✓ PASS   Feeding Plan Creation
✓ PASS   Active Plans Retrieval
✓ PASS   Feeding Log Creation
✓ PASS   Inventory Deduction
✓ PASS   Task Generation
✓ PASS   Task-Feeding Completion
============================================================
Results: 12/12 tests passed
🎉 All tests passed!
```

### 4. Start API Server

```bash
cd apps/api
uvicorn src.app.main:app --reload
```

Server will start on `http://localhost:8000`

### 5. Manual API Testing (Optional)

Use the interactive API docs at `http://localhost:8000/docs`

#### Test Workflow:

1. **Login** (POST `/auth/login`)
   - Get JWT token

2. **Create Inventory Item** (POST `/inventory/items`)
   ```json
   {
     "name": "Premium Dog Food",
     "category": "food",
     "unit": "kg",
     "reorder_threshold": 10
   }
   ```

3. **Add Stock Lot** (POST `/inventory/lots`)
   ```json
   {
     "item_id": "[item_id_from_step_2]",
     "quantity": 100,
     "lot_number": "LOT2024-001",
     "expires_at": "2025-12-31"
   }
   ```

4. **Create Food** (POST `/feeding/foods`)
   ```json
   {
     "name": "Premium Dog Food",
     "brand": "Royal Canin",
     "type": "dry",
     "kcal_per_100g": 380
   }
   ```

5. **Create Feeding Plan** (POST `/feeding/plans`)
   ```json
   {
     "animal_id": "[your_animal_id]",
     "food_id": "[food_id_from_step_4]",
     "amount_g": 300,
     "times_per_day": 2,
     "schedule_json": {"times": ["08:00", "18:00"]},
     "start_date": "2024-02-12"
   }
   ```

6. **Generate Feeding Tasks** (POST `/feeding/generate-tasks`)
   - Creates tasks for today's scheduled feedings

7. **Complete Feeding Task** (POST `/feeding/tasks/{task_id}/complete`)
   ```json
   {
     "notes": "Fed at scheduled time"
   }
   ```
   - This automatically:
     - Creates feeding log
     - Deducts from inventory
     - Marks task complete

8. **Check Inventory** (GET `/inventory/items`)
   - Verify stock decreased by 0.3 kg (300g)

9. **View Transaction History** (GET `/inventory/transactions`)
   - See the automatic OUT transaction linked to feeding_log

---

## Troubleshooting

### Migration Errors

If you get "column already exists" errors:
```bash
# Check current migration version
cd apps/api
alembic current

# If needed, stamp to specific version
alembic stamp head
```

### Database Connection Errors

Check your `.env` file or config:
```python
DATABASE_URL=postgresql://pet:pet@localhost:5432/petdb
```

Verify PostgreSQL is running:
```bash
# Using Docker
docker-compose -f infra/docker-compose.yml up -d

# Or check if local PostgreSQL is running
psql -U pet -d petdb -c "SELECT 1"
```

### Import Errors

Make sure you're in the `apps/api` directory when running tests:
```bash
cd apps/api
python test_backend.py
```

---

## What's Being Tested

### Core Features
- ✅ **Multi-tenant isolation** - All queries filtered by organization_id
- ✅ **Audit logging** - All create/update operations logged
- ✅ **RBAC enforcement** - Permissions checked on routes
- ✅ **FIFO inventory** - Deducts from oldest lots first
- ✅ **Automatic workflows** - Task completion triggers feeding log + inventory deduction

### Database Schema
- ✅ All foreign keys working
- ✅ Cascade deletes configured correctly
- ✅ JSONB fields (task_metadata, schedule_json) working
- ✅ Enums properly defined and validated

### Business Logic
- ✅ Active feeding plans filter by date range
- ✅ Inventory deduction calculates correctly (grams → kg)
- ✅ Task generation prevents duplicates
- ✅ Transaction history tracks entity relationships

---

## Next Steps After Testing

Once all tests pass:

1. **Deploy to Railway**
   ```bash
   git add .
   git commit -m "feat: complete inventory and feeding system with task integration"
   git push
   ```

2. **Run migrations on Railway**
   ```bash
   railway run alembic upgrade head
   ```

3. **Test API endpoints** via Railway URL

4. **Build Frontend** - All APIs are ready:
   - Task list page
   - Feeding plans management
   - Inventory management
   - Task completion workflow
